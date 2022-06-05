 'reach 0.1';

 
const MUInt = Maybe(UInt);

const common = {
 showOutcome: Fun([UInt], Null)
};
 
const Params = Tuple(Bytes(128), Bytes(256), UInt, UInt);

export const main = Reach.App(() => {
  const Creator = Participant('Creator', {
    // Specify Creator's interact interface here
    ...common,
    startCampaign: Fun([], Params),
    seeDonation: Fun([Address, UInt], Null),
    timeout: Fun([], Null),
  });
  const Investor   = ParticipantClass('Investor', {
    // Specify Investor's interact interface here
    ...common,
    seeParams: Fun([Params], Null),
    getDonation: Fun([UInt], MUInt),
    showMap: Fun([Address, UInt], Null)
  });

  // Investor as API?!
  const I = API('InvestorAPI', {
    invest: Fun([], Null),
    retriveDonation: Fun([], Null),
  });

  init();
  
  Creator.only(() => {
  // Binding the value of getSale to the result of interacting with the participant. This happens in a local step. declassify declassifies the argument, in this case that means the value of getSale
  const [ projectName, projectInfo, targetValue, lenInBlocks ] = declassify(interact.startCampaign());
  });
  Creator.publish(projectName, projectInfo, targetValue, lenInBlocks);
  commit();

  const amt = 1
  
  Creator.pay(amt);
  const end = lastConsensusTime() + lenInBlocks;
  const history = new Map(UInt);

  Investor.interact.seeParams([projectName, projectInfo, targetValue, end]);

  const [lastInvestor, lastDonation, currentPrice, numInvestors] =
    parallelReduce([Creator, amt, amt, 0])
      .invariant(balance() == currentPrice)
      .while(lastConsensusTime() <= end)
      .case(Investor,
        (() => {
          const mbid = declassify(interact.getDonation(currentPrice))
          return ({
            when: maybe(mbid, false, ((b) => b > 0)),
            msg : fromSome(mbid, 0)
          });
        }),  
        ((donation) => donation),
        ((donation) => {
          const isAmountPresent = fromSome(history[this], 0)
          if(isAmountPresent){
            history[this] = isAmountPresent + donation;
          }else{
            history[this] = donation;
          }
          history[this] = fromSome(history[this], 0) + donation;
          Creator.interact.seeDonation(this, donation);
          return [this, donation, currentPrice+donation, isAmountPresent ? numInvestors : numInvestors+1];
        }))
      .timeout(absoluteTime(end), () => {
        Creator.interact.timeout();
        Creator.publish();
        return [lastInvestor, lastDonation, currentPrice, numInvestors];
      });


  // const numInvestors = history.size()
  const failPayTimeout = lastConsensusTime() + lenInBlocks;
  
  // forse è la strada giusta!!!
  if(targetValue>currentPrice){
    const [timedOut_, unpaidInvestors, reamaningAmount] =
      parallelReduce([false, numInvestors, currentPrice])
        .invariant(balance() == reamaningAmount)
        .while(!timedOut_ && unpaidInvestors > 0)
        .api_(I.retriveDonation, () => {
          check(fromSome(history[this], 0)!=0);
          return [ (k) => {
            const amountToRefound = fromSome(history[this], 0)
            if(amountToRefound>0 && balance()>=amountToRefound){
              transfer(amountToRefound).to(this);
            }
            k(null);
            return [false, unpaidInvestors - 1, reamaningAmount-amountToRefound];
          }];
        })
        .timeout(failPayTimeout, () => {
          Creator.interact.timeout();
          Creator.publish();
          return [true, unpaidInvestors, reamaningAmount];
        });
  }

  transfer(balance()).to(Creator)
  commit();

  each([Creator, Investor], () => interact.showOutcome(currentPrice));
  exit();

});