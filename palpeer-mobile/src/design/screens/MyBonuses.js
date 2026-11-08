// My bonuses — design UI (change map: I have / I used).
/* eslint-disable */
import React from 'react';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { speaking: false, tab: 'have' };
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
    const have = this.state.tab === 'have';
    const summary = Array.isArray(p.summary) ? p.summary : [];
    const items = Array.isArray(p.items) ? p.items : [];
    const shown = items.filter((it) => (have ? it.unused : it.used));
    return {
      have,
      pickHave: () => this.setState({ tab: 'have' }),
      pickUsed: () => this.setState({ tab: 'used' }),
      summary,
      items: shown,
      empty: !shown.length,
      emptyText: have ? 'No unused bonuses yet.' : 'Nothing used yet.',
      note: 'Unused is still pending. Used includes bonuses credited to my wallet or applied to a P2P fee.',
      more: () => (p.onLoadMore ? p.onLoadMore() : null),
      hasMore: !!p.hasMore,
      loadingMore: !!p.loadingMore,
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen('My bonuses. ' + (have ? 'I have' : 'I used') + '.'),
    };
  }
}

export default class MyBonusesScreen extends Component {
  static defaultProps = {};
  static title = 'My bonuses';
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
          <DC.T s={{ fontSize: 30, fontWeight: '800', _lhMul: 1.15 }} role="header">{"My bonuses"}</DC.T>
          <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#E1ECFB' }}>
            <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#33453D', _lhMul: 1.35 }}>{v.note}</DC.T>
          </DC.Box>
          <DC.Box s={{ flexShrink: 0, _display: 'grid', _cols: 2, rowGap: 8, columnGap: 8 }}>
            <DC.Box s={{ minHeight: 48, borderRadius: 14, backgroundColor: v.have ? '#0B6E4F' : '#FFFFFF', color: v.have ? '#FFFFFF' : '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.pickHave} selected={v.have}>
              <DC.T>{"I have"}</DC.T>
            </DC.Box>
            <DC.Box s={{ minHeight: 48, borderRadius: 14, backgroundColor: !v.have ? '#0B6E4F' : '#FFFFFF', color: !v.have ? '#FFFFFF' : '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.pickUsed} selected={!v.have}>
              <DC.T>{"I used"}</DC.T>
            </DC.Box>
          </DC.Box>
          {DC.list(v.summary).map((row, $i) => (
            <DC.Box key={$i} s={{ flexShrink: 0, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 6, columnGap: 6 }}>
              <DC.T s={{ fontSize: 14, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{row.currencyCode + ' wallet'}</DC.T>
              <DC.T s={{ fontSize: 26, fontWeight: '800' }}>{row.totalText}</DC.T>
              <DC.Box s={{ _display: 'flex', rowGap: 16, columnGap: 16 }}>
                <DC.Box s={{ flexGrow: 1 }}>
                  <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{"Unused"}</DC.T>
                  <DC.T s={{ fontSize: 17, fontWeight: '800' }}>{row.unusedText}</DC.T>
                </DC.Box>
                <DC.Box s={{ flexGrow: 1 }}>
                  <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{"Used"}</DC.T>
                  <DC.T s={{ fontSize: 17, fontWeight: '800' }}>{row.usedText}</DC.T>
                </DC.Box>
              </DC.Box>
            </DC.Box>
          ))}
          {v.empty ? (
            <DC.Box s={{ paddingTop: 24, _display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DC.T s={{ fontSize: 17, fontWeight: '600', color: '#46574F' }}>{v.emptyText}</DC.T>
            </DC.Box>
          ) : (
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
              {DC.list(v.items).map((row, $i) => (
                <DC.Box key={$i} s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                  <DC.T s={{ fontSize: 20, fontWeight: '800' }}>{row.amountText}</DC.T>
                  <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#46574F' }}>{row.note}</DC.T>
                  <DC.T s={{ fontSize: 14, fontWeight: '700', color: '#0B6E4F' }}>{row.statusLabel}</DC.T>
                </DC.Box>
              ))}
              {v.hasMore ? (
                <DC.Box s={{ minHeight: 52, borderRadius: 16, backgroundColor: '#E9EEEB', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.more} disabled={v.loadingMore}>
                  <DC.T>{v.loadingMore ? 'Loading…' : 'Load more'}</DC.T>
                </DC.Box>
              ) : null}
            </DC.Box>
          )}
        </DC.Box>
      </DC.Box>
    );
  }
}
