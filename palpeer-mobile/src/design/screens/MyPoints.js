// My points — design UI for the loyalty points ledger (change map).
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
    const balancePts = p.balancePoints != null ? p.balancePoints : 0;
    const balanceCad = p.balanceCadText || 'CA$0.00';
    const earned = p.earnedPoints != null ? p.earnedPoints : 0;
    const used = p.usedPoints != null ? p.usedPoints : 0;
    const per = p.pointsPerCad || 100;
    const entries = Array.isArray(p.entries) ? p.entries : [];
    const empty = !entries.length;
    return {
      balancePts: String(balancePts) + ' pts',
      balanceCad,
      earned: String(earned) + ' pts',
      used: String(used) + ' pts',
      rule: per + ' points = CA$1. Earn points when friends join with your invite code. Use them to cut your P2P fee.',
      empty,
      entries,
      invite: () => (p.onInvite ? p.onInvite() : null),
      more: () => (p.onLoadMore ? p.onLoadMore() : null),
      hasMore: !!p.hasMore,
      loadingMore: !!p.loadingMore,
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen(
        'My points. Available ' + balancePts + ' points, worth ' + balanceCad +
        '. Earned ' + earned + '. Used ' + used + '.'
      ),
    };
  }
}

export default class MyPointsScreen extends Component {
  static defaultProps = {};
  static title = 'My points';
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
              <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M4 9.500v5h3.500L13 19V5L7.500 9.500H4z" fill="currentColor" /><SVG.Path d="M16.500 9a4.500 4.500 0 0 1 0 6" /><SVG.Path d="M19 6.500a8 8 0 0 1 0 11" /></DC.Icon>
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.Box>
          <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, _lhMul: 1.15 }} role="header">{"My points"}</DC.T>
          <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#E1ECFB', color: '#0E1F19' }}>
            <DC.T s={{ fontSize: 16, _lhMul: 1.35, fontWeight: '600', color: '#33453D' }}>{v.rule}</DC.T>
          </DC.Box>
          <DC.Box s={{ flexShrink: 0, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
            <DC.T s={{ fontSize: 14, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{"Available"}</DC.T>
            <DC.T s={{ fontSize: 34, fontWeight: '800', _lhMul: 1.1 }}>{v.balancePts}</DC.T>
            <DC.T s={{ fontSize: 17, fontWeight: '600', color: '#46574F' }}>{"Worth " + v.balanceCad}</DC.T>
            <DC.Box s={{ _display: 'flex', rowGap: 16, columnGap: 16 }}>
              <DC.Box s={{ flexGrow: 1, _display: 'flex', flexDirection: 'column', rowGap: 2, columnGap: 2 }}>
                <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{"Earned"}</DC.T>
                <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{v.earned}</DC.T>
              </DC.Box>
              <DC.Box s={{ flexGrow: 1, _display: 'flex', flexDirection: 'column', rowGap: 2, columnGap: 2 }}>
                <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{"Used"}</DC.T>
                <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{v.used}</DC.T>
              </DC.Box>
            </DC.Box>
          </DC.Box>
          <DC.Box s={{ flexShrink: 0, minHeight: 56, borderWidth: 0, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.invite}>
            <DC.T>{"Invite friends to earn more"}</DC.T>
          </DC.Box>
          {v.empty ? (
            <DC.Box s={{ flexShrink: 0, paddingTop: 28, paddingBottom: 28, _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 10, columnGap: 10 }}>
              <DC.T s={{ fontSize: 22, fontWeight: '800' }}>{"No points yet"}</DC.T>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F', textAlign: 'center' }}>{"Share my invite code. When a friend joins and passes ID check, I earn points set by Palpeer."}</DC.T>
            </DC.Box>
          ) : (
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
              <DC.T s={{ fontSize: 20, fontWeight: '800' }}>{"Ledger"}</DC.T>
              {DC.list(v.entries).map((row, $i) => (
                <DC.Box key={$i} s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                  <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8 }}>
                    <DC.T s={{ fontSize: 20, fontWeight: '800' }}>{row.pointsLabel}</DC.T>
                    <DC.T s={{ fontSize: 14, fontWeight: '800', color: row.tone === 'earned' ? '#0B6E4F' : '#46574F' }}>{row.statusLabel}</DC.T>
                  </DC.Box>
                  <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#46574F' }}>{row.note}</DC.T>
                  <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{row.cadLabel}</DC.T>
                </DC.Box>
              ))}
              {v.hasMore ? (
                <DC.Box s={{ flexShrink: 0, minHeight: 52, borderRadius: 16, backgroundColor: '#E9EEEB', color: '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.more} disabled={v.loadingMore}>
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
