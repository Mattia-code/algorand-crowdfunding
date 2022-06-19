import React from 'react';

const exports = {};

const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

exports.Wrapper = class extends React.Component {
  render() {
    const {content} = this.props;
    return (
      <div className="Deployer">
        <h2>Deployer (Platform)</h2>
        {content}
      </div>
    );
  }
}

exports.SetParams = class extends React.Component {
  render() {
    const {
      parent, 
      defaultCreatorInvestment, 
      defaultInvestorInvestment,
      defaultInvestorFailProfit,
      defaultInvestorQuorum,
      defaultInvestmentDuration,
      defaultFailPayDuration, 
      standardUnit
    } = this.props;

    const creatorInvestment = (this.state || {}).creatorInvestment || defaultCreatorInvestment;
    const investorInvestment = (this.state || {}).investorInvestment || defaultInvestorInvestment;
    const investorFailProfit = (this.state || {}).investorFailProfit || defaultInvestorFailProfit;
    const investorQuorum = (this.state || {}).investorQuorum || defaultInvestorQuorum;
    const investmentDuration = (this.state || {}).investmentDuration || defaultInvestmentDuration;
    const failPayDuration = (this.state || {}).failPayDuration || defaultFailPayDuration;

    return (
      <div>
        Creator Investment: 
        <input
          type='number'
          label='Creator Investment'
          placeholder={defaultCreatorInvestment}
          onChange={(e) => this.setState({creatorInvestment: e.currentTarget.value})}
        /> {standardUnit}
        <br />
        Investor Investment: 
        <input
          type='number'
          label='Investor Investment'
          placeholder={defaultInvestorInvestment}
          onChange={(e) => this.setState({investorInvestment: e.currentTarget.value})}
        /> {standardUnit}
        <br />
        Investor Fail Profit: 
        <input
          type='number'
          label='Investor Fail Profit'
          placeholder={defaultInvestorFailProfit}
          onChange={(e) => this.setState({investorFailProfit: e.currentTarget.value})}
        /> {standardUnit}
        <br />
        Investor Quorum: 
        <input
          type='number'
          label='Investor Quorum'
          placeholder={defaultInvestorQuorum}
          onChange={(e) => this.setState({investorQuorum: e.currentTarget.value})}
        />
        <br />
        Investment Duration: 
        <input
          type='number'
          label='Investment Duration'
          placeholder={defaultInvestmentDuration}
          onChange={(e) => this.setState({investmentDuration: e.currentTarget.value})}
        />
        <br />
        Fail Pay Duration: 
        <input
          type='number'
          label='Fail Pay Duration'
          placeholder={defaultFailPayDuration}
          onChange={(e) => this.setState({failPayDuration: e.currentTarget.value})}
        />
        <br />
        <button
          onClick={() => {
              parent.setCreatorInvestment(creatorInvestment)
              parent.setInvestorInvestment(investorInvestment)
              parent.setInvestorFailProfit(investorFailProfit)
              parent.setInvestorQuorum(investorQuorum)
              parent.setInvestmentDuration(investmentDuration)
              parent.setFailPayDuration(failPayDuration)
            }
          }
        >Set Params</button>
      </div>
    );
  }
}

exports.Deploy = class extends React.Component {
  render() {
    const {
      parent, 
      creatorInvestment, 
      investorInvestment,
      investorFailProfit,
      investorQuorum,
      investmentDuration,
      failPayDuration, 
      standardUnit
    } = this.props;
    return (
      <div>
        Creator investment: <strong>{creatorInvestment}</strong> {standardUnit}
        <br />
        Investor investment: <strong>{investorInvestment}</strong> {standardUnit}
        <br />
        Investor fail profit: <strong>{investorFailProfit}</strong> {standardUnit}
        <br />
        Investor quorum: <strong>{investorQuorum}</strong>
        <br />
        Investment duration: <strong>{investmentDuration}</strong>
        <br />
        Fail Pay duration: <strong>{failPayDuration}</strong>
        <br />
        <button
          onClick={() => parent.deploy()}
        >Deploy</button>
      </div>
    );
  }
}

exports.ConctractPhase = class extends React.Component {
  render() {
    const {
      parent, 
      phase
    } = this.props;
    return (
      <div>{phase} 
      <button
          onClick={() => {parent.updatePhase()}}
        >Update</button>
      </div>
    );
  }
}

exports.Deploying = class extends React.Component {
  render() {
    return (
      <div>Deploying... please wait.</div>
      
    );
  }
}

exports.WaitingForCreator = class extends React.Component {
  
  async copyToClipboard(button) {
    const {ctcInfoStr} = this.props;
    navigator.clipboard.writeText(ctcInfoStr);
    const origInnerHTML = button.innerHTML;
    button.innerHTML = 'Copied!';
    button.disabled = true;
    await sleep(1000);
    button.innerHTML = origInnerHTML;
    button.disabled = false;
  }

  render() {
    const {parent, ctcInfoStr} = this.props;
    return (
      <div>
        Waiting for Creator to join...
        <br /> Please give them this contract info:
        <pre className='ContractInfo'>
          {ctcInfoStr}
        </pre>
        <button
          onClick={(e) => this.copyToClipboard(e.currentTarget)}
        >Copy to clipboard</button>
        <button
          onClick={() => parent.startInvestment()}
        >Start Investment</button>
      </div>
    )
  }
}

export default exports;