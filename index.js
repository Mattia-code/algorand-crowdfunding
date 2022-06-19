import React from 'react';
import AppViews from './views/AppViews';
import DeployerViews from './views/DeployerViews';
import CreatorViews from './views/CreatorViews';
import InvestorViews from './views/InvestorViews';
import {renderDOM, renderView} from './views/render';
import './index.css';
import * as backend from './build/index.main.mjs';
import { loadStdlib } from '@reach-sh/stdlib';
const reach = loadStdlib(process.env);

const {standardUnit} = reach;

const defaults = { 
  defaultCreatorInvestment: '20', 
  defaultInvestorInvestment: '10', 
  defaultInvestorFailProfit: '3',
  defaultInvestorQuorum: '5',
  defaultInvestmentDuration: '300',
  defaultFailPayDuration: '300',
  standardUnit
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {view: 'ConnectAccount', ...defaults};
  }
  async componentDidMount() {
    const acc = await reach.getDefaultAccount();
    const balAtomic = await reach.balanceOf(acc);
    const bal = reach.formatCurrency(balAtomic, 4);
    this.setState({acc, bal});
    if (await reach.canFundFromFaucet()) {
      this.setState({view: 'FundAccount'});
    } else {
      this.setState({view: 'DeployerCreatorInvestor'});
    }
  }
  async fundAccount(fundAmount) {
    await reach.fundFromFaucet(this.state.acc, reach.parseCurrency(fundAmount));
    this.setState({view: 'DeployerCreatorInvestor'});
  }
  async skipFundAccount() { this.setState({view: 'DeployerCreatorInvestor'}); }
  selectInvestor() { this.setState({view: 'Wrapper', ContentView: Investor}); }
  selectCreator() { this.setState({view: 'Wrapper', ContentView: Creator}); }
  selectDeployer() { this.setState({view: 'Wrapper', ContentView: Deployer}); }
  render() { return renderView(this, AppViews); }
}

class Deployer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {view: 'SetParams'};
  }

  setCreatorInvestment(creatorInvestment) { this.setState({view: 'Deploy', creatorInvestment}); }
  setInvestorInvestment(investorInvestment) { this.setState({view: 'Deploy', investorInvestment}); }
  setInvestorFailProfit(investorFailProfit) { this.setState({view: 'Deploy', investorFailProfit}); }
  setInvestorQuorum(investorQuorum) { this.setState({view: 'Deploy', investorQuorum}); }
  setInvestmentDuration(investmentDuration) { this.setState({view: 'Deploy', investmentDuration}); }
  setFailPayDuration(failPayDuration) { this.setState({view: 'Deploy', failPayDuration}); }
  
  async deploy() {
    const ctc = this.props.acc.contract(backend);
    this.setState({view: 'Deploying', ctc});
    this.investmentStructure = {
      creatorInvestment: reach.parseCurrency(this.state.creatorInvestment), // UInt
      investorInvestment: reach.parseCurrency(this.state.investorInvestment), // UInt
      investorFailProfit: reach.parseCurrency(this.state.investorFailProfit), // UInt
      investorQuorum: +this.state.investorQuorum,
      investmentDuration: {ETH: +this.state.investmentDuration, ALGO: +this.state.investmentDuration*10, CFX: +this.state.investmentDuration*1000}[reach.connector], // UInt
      failPayDuration: {ETH: +this.state.investmentDuration, ALGO: +this.state.investmentDuration*10, CFX: +this.state.investmentDuration*1000}[reach.connector], // UInt
    }
    console.log('this', this)
    this.ready = reach.disconnect;
    backend.Platform(ctc, this);
    const ctcInfoStr = JSON.stringify(await ctc.getInfo(), null, 2);
    this.setState({view: 'WaitingForCreator', ctcInfoStr});
  }

  async startInvestment(){
    console.log('hello??')
    const ctc = this.props.acc.contract(backend);
    console.log('hello???', ctc)
    await backend.PlatformAPI_startInvestment(ctc, {})
    const ev = backend._getEvents();
    console.log('ev', ev)
    const phase = ev.what[0][0]; // get the name of the phase from the event structure
    console.log('phase', phase)
    this.setState({view: 'ConctractPhase', phase});
  }

  async updatePhase(){
    const ctc = this.props.acc.contract(backend);
    const ev = await ctc.events.ContractPhase.phase.next();
    const phase = ev.what[0][0]; // get the name of the phase from the event structure
    console.log('phase', phase)
    this.setState({view: 'ConctractPhase', phase});
  }

  render() { return renderView(this, DeployerViews); }
}

class Creator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {view: 'Connect'};
  }
  connect(ctcInfoStr) {
    const ctc = this.props.acc.contract(backend, JSON.parse(ctcInfoStr));
    this.setState({view: 'Connected'});
    backend.Creator(ctc, this);
  }

  render() { return renderView(this, CreatorViews); }
}

class Investor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {view: 'Connect'};
  }
  
  async connect(ctcInfoStr) {
    const ctc = this.props.acc.contract(backend, JSON.parse(ctcInfoStr));
    this.setState({view: 'Connected'});
    // backend.Creator(ctc, this);
    await ctc.apis.Investor.invest();
  }

  render() { return renderView(this, InvestorViews); }
}

renderDOM(<App />);