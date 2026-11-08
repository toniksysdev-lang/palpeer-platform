// Promotions — design UI for live admin offers (change map).
/* eslint-disable */
import React from 'react';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { speaking: false };
  }
  listen(text) {
    try {
      const s = window.speechSynthesis;
      if (this.state.speaking) {
        s.cancel();
        this.setState({ speaking: false });
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-NG';
      u.onend = () => this.setState({ speaking: false });
      this.setState({ speaking: true });
      s.speak(u);
    } catch (e) {
      this.setState({ speaking: false });
    }
  }
  renderVals() {
    const p = this.props;
    const items = Array.isArray(p.items) ? p.items : [];
    return {
      items,
      empty: !items.length,
      invite: () => (p.onInvite ? p.onInvite() : null),
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen('Promotions. ' + (items.length ? items.map((i) => i.title).join('. ') : 'No offers right now') + '.'),
    };
  }
}

export default class MyPromotionsScreen extends Component {
  static defaultProps = {};
  static title = 'Promotions';
  static background = '#F3F6F4';

  render() {
    const v = this.renderVals() || {};
    return (
      <DC.Box s={{ position: 'relative', backgroundColor: '#F3F6F4', color: '#0E1F19', fontFamily: "'Noto Sans', system-ui, sans-serif", _display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <DC.Box s={{ flexGrow: 1, minHeight: 0, paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14, _scroll: 'y' }}>
          <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 12, minHeight: 52 }}>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 10, borderWidth: 0, borderRadius: 26, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 6, columnGap: 6 }} kind="link" href="More.dc.html">
              <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M20 12H5M11 6l-6 6 6 6" /></DC.Icon>
              <DC.T>{"Back"}</DC.T>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label="Listen to this screen">
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.Box>
          <DC.T s={{ fontSize: 30, fontWeight: '800', _lhMul: 1.15 }} role="header">{"Promotions"}</DC.T>
          <DC.T s={{ fontSize: 17, fontWeight: '600', color: '#46574F', _lhMul: 1.35 }}>{"Live offers from Palpeer. Use a code on my next P2P fee, or invite friends for points."}</DC.T>
          {v.empty ? (
            <DC.Box s={{ paddingTop: 28, _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 10, columnGap: 10 }}>
              <DC.T s={{ fontSize: 22, fontWeight: '800' }}>{"No offers right now"}</DC.T>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F', textAlign: 'center' }}>{"Check back later for new promotions."}</DC.T>
            </DC.Box>
          ) : (
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
              {DC.list(v.items).map((row, $i) => (
                <DC.Box key={$i} s={{ flexShrink: 0, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 6, columnGap: 6 }}>
                  <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8 }}>
                    <DC.T s={{ fontSize: 20, fontWeight: '800', flexGrow: 1 }}>{row.title}</DC.T>
                    <DC.T s={{ fontSize: 13, fontWeight: '800', color: '#1D5BC7' }}>{row.typeLabel}</DC.T>
                  </DC.Box>
                  {row.code ? <DC.T s={{ fontSize: 16, fontWeight: '800', color: '#0B6E4F' }}>{row.code}</DC.T> : null}
                  {row.description ? <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#46574F', _lhMul: 1.35 }}>{row.description}</DC.T> : null}
                  <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{row.windowText}</DC.T>
                  {row.isInvite ? (
                    <DC.Box s={{ marginTop: 6, minHeight: 48, borderRadius: 14, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.invite}>
                      <DC.T>{"Open my invite code"}</DC.T>
                    </DC.Box>
                  ) : null}
                </DC.Box>
              ))}
            </DC.Box>
          )}
        </DC.Box>
      </DC.Box>
    );
  }
}
