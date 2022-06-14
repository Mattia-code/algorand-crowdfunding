'reach 0.1';
'use strict';

const InvestmentStructureT = Object({
  creatorInvestment: UInt, // Creator's contribution to the product funding
  creatorProfit: UInt,     // Creator's profit when the quorum is met
  investorInvestment: UInt,     // Each investor's contribution to the product funding
  investorFailProfit: UInt,     // Each investor's profit if the quorum is not met
  investorQuorum: UInt,         // Target of investors needed to successfully fund the product
  targetContribution: UInt,
  investmentDuration: UInt,     // How long funding will be open to investors
  failPayDuration: UInt,        // How long failure pay will be available for investors to claim
});

export const main = Reach.App(() => {
  const P = Participant('Product', {
    investmentStructure: InvestmentStructureT,
    ready: Fun([], Null),
  });
  const E = Participant('Creator', {});
  const I = API('Investor', {
    invest: Fun([], Null),
    collectFailPay: Fun([], Null),
  });
  const PA = API('ProductAPI', {
    startInvestment: Fun([], Null),
    investmentTimeout: Fun([], Null),
    failPayTimeout: Fun([], Null),
  });
  const Phase = Data({ Investment: Null, FailPay: Null, Finished: Null });
  const CP = Events('ContractPhase', { phase: [Phase] });
  init();

  const checkInvestmentStructure = (iso) => {
    const expectedFunds = iso.creatorInvestment
                        + iso.investorQuorum * iso.investorInvestment;
    check(iso.creatorProfit <= expectedFunds);
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
    creatorProfit,
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
  E.pay(starterInvestment);
  commit();

  P.interact.ready();

  const awaitProductApi = (apiFunc) => {
    const [[], k] = call(apiFunc).assume(() => check(this == P));
    check(this == P);
    k(null);
  }

  awaitProductApi(PA.startInvestment);
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
    .invariant(numInvestors <= investorQuorum)
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
      awaitProductApi(PA.investmentTimeout);
      return [true, numInvestors, totalContribution];
    });

  if (totalContribution>=targetContribution) {
    // Funding succeeded
    // The creator is paid their creatorship incentive profit,
    // and the remainder of funds are sent to the product.
    transfer(creatorProfit).to(E);
  } else {
    // Funding failed
    // The creator must be returned their starter investment plus unnecessary fail pay,
    // each investor must be given the opportunity to claim their fail pay,
    // and any unclaimed fail pay will be given to the product.
    const returnedToCreator = starterInvestment
                                 - investorFailProfit * numInvestors;
    transfer(returnedToCreator).to(E);

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
        awaitProductApi(PA.failPayTimeout);
        return [true, unpaidInvestors];
      });
  }

  transfer(balance()).to(P);
  CP.phase(Phase.Finished());
  commit();
  exit();
});