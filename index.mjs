import {loadStdlib} from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';
const stdlib = loadStdlib(process.env);

const investmentStructure = {
  creatorInvestment: stdlib.parseCurrency(20),
  investorInvestment: stdlib.parseCurrency(10),
  investorFailProfit: stdlib.parseCurrency(3),
  investorQuorum: 5,
  targetContribution: stdlib.parseCurrency(100),
  investmentDuration: 300,
  failPayDuration: 300,
};

const run = async (numInvestors, numInvestorsFailPaid) => {
  const [accPlatform, accCreator] = await stdlib.newTestAccounts(2, stdlib.parseCurrency(100));
  const investors = await stdlib.newTestAccounts(numInvestors, stdlib.parseCurrency(15));
  const ctcPlatform = accPlatform.contract(backend);
  const ctcCreator = accCreator.contract(backend, ctcPlatform.getInfo());
  const investorCtcs = investors.map(i => i.contract(backend, ctcPlatform.getInfo()));

  const printBals = async () => {
    const printBal = async (name, acc) => {
      const bal = stdlib.formatCurrency(await stdlib.balanceOf(acc));
      console.log(`  + ${name} has ${bal} ${stdlib.standardUnit}`);
    };

    await printBal('Platform', accPlatform);
    await printBal('Creator', accCreator);
    for (let i = 0; i < numInvestors; i++) {
      await printBal(`Investor #${i+1}`, investors[i]);
    }
  }

  console.log(`Running contract with ${numInvestors} investors of ${investmentStructure.investorQuorum} needed`);
  console.log("Starting balances:");
  await printBals();

  // Launch the contract
  await stdlib.withDisconnect(() => Promise.all([
    ctcPlatform.p.Platform({
      investmentStructure,
      ready: stdlib.disconnect,
    }),
    ctcCreator.p.Creator({})
  ]));

  await ctcPlatform.apis.PlatformAPI.startInvestment();

  let phase;
  do {
    const ev = await ctcPlatform.events.ContractPhase.phase.next();
    phase = ev.what[0][0]; // get the name of the phase from the event structure
    switch (phase) {
      // Funding has started
      case 'Investment':
        for (const [i, ctc] of investorCtcs.entries()) {
          console.log(`Investor #${i+1} invests`);
          await ctc.apis.Investor.invest();
        }

        if (numInvestors < investmentStructure.investorQuorum) {
          await stdlib.wait(investmentStructure.investmentDuration)
          await ctcPlatform.apis.PlatformAPI.investmentTimeout();
        }
        break;

      // Funding failed, so investors can now collect their fail pay
      case 'FailPay':
        for (const [i, ctc] of investorCtcs.slice(0, numInvestorsFailPaid).entries()) {
          console.log(`Investor #${i+1} collects their fail pay`);
          await ctc.apis.Investor.collectFailPay();
        }

        if (numInvestorsFailPaid < numInvestors) {
          await stdlib.wait(investmentStructure.failPayDuration);
          await ctcPlatform.apis.PlatformAPI.failPayTimeout();
        }
        break;

      // The contract is now over
      case 'Finished':
        console.log("Finishing balances:");
        await printBals();
        console.log();
        break;
    }
  } while (phase != 'Finished');
};

await run(5);
await run(4, 4);
await run(4, 2);