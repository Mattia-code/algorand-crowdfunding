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

  Investor.interact.seeParams([projectName, projectInfo, targetValue, end]);

  const [lastInvestor, lastDonation, currentPrice] =
    parallelReduce([Creator, amt, amt])
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
          Creator.interact.seeDonation(this, donation);
          return [this, donation, currentPrice+donation];
        }))
      .timeout(absoluteTime(end), () => {
        Creator.interact.timeout();
        Creator.publish();
        return [lastInvestor, lastDonation, currentPrice];
      });
  
  // qui dovrebbe restiruire a tutti i partecipanti il totale versato se il valore non
  // è stato raggiunto.
  if(currentPrice>=targetValue){
    transfer(currentPrice).to(Creator)
  }else{
    transfer(lastDonation).to(lastInvestor)
  }
  commit();

  each([Creator, Investor], () => interact.showOutcome(currentPrice));
  exit();

});