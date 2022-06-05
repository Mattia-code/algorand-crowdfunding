import { loadStdlib } from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';

const N = 3;
const names = ["Creator", "Alice", "Bob", "Carla"];

(async () => {
  const stdlib = await loadStdlib(process.env);
  const startingBalance = stdlib.parseCurrency(100);
  const [ accCreator, ...accInvestor ] =
    await stdlib.newTestAccounts(1+N, startingBalance);

  await Promise.all( [ accCreator, ...accInvestor ].map(async (acc, i) => {
    acc.setDebugLabel(names[i]);
  }));

  const showBalance = async (acc, i) => {
    const amt = await stdlib.balanceOf(acc);
    console.log(`${names[i]} has ${stdlib.formatCurrency(amt)} ${stdlib.standardUnit}`);
  };

  const ctcCreator = accCreator.contract(backend);

  await Promise.all([
    (async () => {
      await showBalance(accCreator, 0);
      const n = names[0];
      await backend.Creator(ctcCreator, {
        startCampaign: () => {
          console.log(`${n} sets parameters of sale`);
          return [ 'MyProject!', 'Awesome Project!', stdlib.parseCurrency(300), 30 ]
        },
        seeDonation: (who, bid) => {
          console.log(`${n} saw that ${stdlib.formatAddress(who)} donate ${stdlib.formatCurrency(bid)}`);
        },
        timeout: () => {
          console.log(`${n} observes the campaign has hit the timeout`);
        },
        showOutcome: (total) => {
          console.log(`${n} saw has collected ${stdlib.formatCurrency(total)} ${stdlib.standardUnit}`);
        },
      });
      await showBalance(accCreator, 0);
    })(),
    ...accInvestor.map(async (acc, i) => {
      await showBalance(acc, i+1);
      const n = names[i+1];
      const ctc = acc.contract(backend, ctcCreator.getInfo());
      const donation = stdlib.parseCurrency(Math.random() * 10);
      console.log(`${n} decides to donate ${stdlib.formatCurrency(donation)}`);
      await backend.Investor(ctc, {
        showOutcome: (total) => {
            console.log(`${n} saw has collected ${stdlib.formatCurrency(total)} ${stdlib.standardUnit}`);
        },
        seeParams: async ([projectName, projectInfo, targetValue, end]) => {
          console.log(`${n} sees that the ${projectName} is ${projectInfo}, the target price is ${stdlib.formatCurrency(targetValue)}, and that they have until ${end} to donate`);
        },
        getDonation: (currentValue) => {
          console.log(`${n} donate ${stdlib.formatCurrency(donation)} / ${stdlib.formatCurrency(currentValue)}`);
          return ['Some', donation];
        },
      });
      await showBalance(acc, i+1);
      return;
    },
  )]);
})();