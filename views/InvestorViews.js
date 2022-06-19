import React from 'react';

const exports = {};

exports.Wrapper = class extends React.Component {
  render() {
    const {content} = this.props;
    return (
      <div className="Investor">
        <h2>Investor</h2>
        {content}
      </div>
    );
  }
}

exports.Connect = class extends React.Component {
  render() {
    const {parent} = this.props;
    const {ctcInfoStr} = this.state || {};
    return (
      <div>
        Please paste the contract info to attach to:
        <br />
        <textarea spellCheck="false"
          className='ContractInfo'
          onChange={(e) => this.setState({ctcInfoStr: e.currentTarget.value})}
          placeholder='{}'
        />
        <br />
        <button
          disabled={!ctcInfoStr}
          onClick={() => parent.connect(ctcInfoStr)}
        >Invest!</button>
      </div>
    );
  }
}

exports.Connected = class extends React.Component {
  render() {
    return (
      <div>
        Connected, please wait...
      </div>
    );
  }
}

export default exports;