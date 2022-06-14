'reach 0.1';
'use strict';

const InvestmentStructureT = Object({
  creatorInvestment: UInt,      // Creator's contribution to the product funding
  investorInvestment: UInt,     // Each investor's contribution to the product funding
  investorFailProfit: UInt,     // Each investor's profit if the quorum is not met
  investorQuorum: UInt,         // Target of investors needed to successfully fund the product
  targetContribution: UInt,     // Target of contribution needed to successfully fund the product
  investmentDuration: UInt,     // How long funding will be open to investors
  failPayDuration: UInt,        // How long failure pay will be available for investors to claim
});

export const main = Reach.App(() => {
  const P = Participant('Platform', {
    investmentStructure: InvestmentStructureT,
    ready: Fun([], Null),
  });
  const C = Participant('Creator', {});
  const I = API('Investor', {
    invest: Fun([], Null),
    collectFailPay: Fun([], Null),
  });
  const PA = API('PlatformAPI', {
    startInvestment: Fun([], Null),
    investmentTimeout: Fun([], Null),
    failPayTimeout: Fun([], Null),
  });
  const Phase = Data({ Investment: Null, FailPay: Null, Finished: Null });
  const CP = Events('ContractPhase', { phase: [Phase] });
  init();

  const checkInvestmentStructure = (iso) => {
    check(iso.targetContribution > iso.creatorInvestment)
    check(iso.investorQuorum > 1);
    check(iso.investorInvestment > 0);
    check(iso.investorFailProfit > 0);
  };

  // A participant representing the product being funded specifies how investment will work
  P.only(() => {
    const investmentStructure = declassify(interact.investmentStructure);
    checkInvestmentStructure(investmentStructure);
  });
  P.publish(investmentStructure);
  checkInvestmentStructure(investmentStructure);

  const {
    creatorInvestment,
    investorInvestment,
    investorQuorum,
    targetContribution,
    investorFailProfit,
    investmentDuration,
    failPayDuration
  } = investmentStructure;

  commit();

  // Creator kicks off the contract by paying their investment plus enough
  // to compensate investors in the case of failure
  const starterInvestment = creatorInvestment
                          + investorFailProfit * (investorQuorum - 1);

  const fee = muldiv(starterInvestment,2,100)
  
  C.pay(starterInvestment + fee);
  transfer(fee).to(P)
  commit();
  P.interact.ready();

  const awaitPlatformApi = (apiFunc) => {
    const [[], k] = call(apiFunc).assume(() => check(this == P));
    check(this == P);
    k(null);
  }

  awaitPlatformApi(PA.startInvestment);
  CP.phase(Phase.Investment());

  // In a real-world application, this would probably be absolute
  // Using relativeTime is easier for testing
  const investmentTimeout = relativeTime(investmentDuration);
  const investors = new Set();

  // Investors are given a change to invest
  const [timedOut, numInvestors, totalContribution] =
    parallelReduce([false, 0, starterInvestment])
    .invariant(balance() == starterInvestment + numInvestors * investorInvestment)
    .invariant(investors.Map.size() == numInvestors)
    // .invariant(numInvestors <= investorQuorum)
    .while(!timedOut && numInvestors < investorQuorum)
    .api_(I.invest, () => {
      check(!investors.member(this));
      return [ investorInvestment, (k) => {
        investors.insert(this);
        k(null);
        return [false, numInvestors + 1, totalContribution+investorInvestment];
      }];
    })
    .timeout(investmentTimeout, () => {
      awaitPlatformApi(PA.investmentTimeout);
      return [true, numInvestors, totalContribution];
    });

  if (totalContribution<targetContribution) {
    // Funding failed
    // The creator must be returned their starter investment plus unnecessary fail pay,
    // each investor must be given the opportunity to claim their fail pay,
    // and any unclaimed fail pay will be given to the product.
    const returnedToCreator = starterInvestment
                                 - investorFailProfit * numInvestors;
    transfer(returnedToCreator).to(C);

    CP.phase(Phase.FailPay());

    // In a real-world application, this would probably be absolute
    // Using relativeTime is easier for testing
    const failPayTimeout = relativeTime(failPayDuration);
    const investorFailPay = investorInvestment + investorFailProfit

    const [timedOut_, unpaidInvestors] =
      parallelReduce([false, numInvestors])
      .while(!timedOut_ && unpaidInvestors > 0)
      .invariant(balance() == unpaidInvestors * investorFailPay)
      .api_(I.collectFailPay, () => {
        check(investors.member(this));
        return [ (k) => {
          investors.remove(this);
          transfer(investorFailPay).to(this);
          k(null);
          return [false, unpaidInvestors - 1];
        }];
      })
      .timeout(failPayTimeout, () => {
        awaitPlatformApi(PA.failPayTimeout);
        return [true, unpaidInvestors];
      });
  }
 
  // fee for the platform
  transfer(muldiv(balance(),2,100)).to(P)

  // contribute for the creator
  transfer(balance()).to(C);

  CP.phase(Phase.Finished());
  commit();
  exit();
});