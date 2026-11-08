// Invite friends — design UI for invite code + people I invited (change map).
/* eslint-disable */
import React from 'react';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { speaking: false, tab: props.tab || 'code', copyStatus: '' };
  }
  componentWillUnmount() {
    clearTimeout(this._copyTimer);
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
  setCopyStatus(status) {
    clearTimeout(this._copyTimer);
    this.setState({ copyStatus: status });
    if (status) {
      this._copyTimer = setTimeout(() => this.setState({ copyStatus: '' }), 2000);
    }
  }
  renderVals() {
    const p = this.props;
    const codeTab = this.state.tab === 'code';
    const code = p.referralCode || '';
    const people = Array.isArray(p.people) ? p.people : [];
    const copied = this.state.copyStatus === 'Copied';
    return {
      codeTab,
      pickCode: () => this.setState({ tab: 'code' }),
      pickPeople: () => this.setState({ tab: 'people' }),
      code: code || '—',
      hasCode: !!code,
      shareMsg: p.shareMessage || '',
      joinedText: p.joinedText || 'Nobody has joined yet',
      people,
      emptyPeople: !people.length,
      share: () => (p.onShare ? p.onShare() : null),
      copy: async () => {
        if (!code) return;
        try {
          if (p.onCopy) {
            const result = await p.onCopy();
            if (result && result.ok === false) {
              this.setCopyStatus(result.error || 'Could not copy');
              return;
            }
          } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(code);
          }
          this.setCopyStatus('Copied');
        } catch (e) {
          this.setCopyStatus('Could not copy');
        }
      },
      copyLabel: this.state.copyStatus || 'Copy code',
      copyBg: copied ? '#0B6E4F' : 'transparent',
      copyInk: copied ? '#FFFFFF' : '#0B6E4F',
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen(
        codeTab
          ? ('My invite code. ' + (code || 'No code yet') + '.')
          : ('People I invited. ' + (p.joinedText || '') + '.')
      ),
    };
  }
}

export default class InviteFriendsScreen extends Component {
  static defaultProps = {};
  static title = 'Invite friends';
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
          <DC.T s={{ fontSize: 30, fontWeight: '800', _lhMul: 1.15 }} role="header">{"Invite friends"}</DC.T>
          <DC.Box s={{ flexShrink: 0, _display: 'grid', _cols: 2, rowGap: 8, columnGap: 8 }}>
            <DC.Box s={{ minHeight: 48, borderRadius: 14, backgroundColor: v.codeTab ? '#0B6E4F' : '#FFFFFF', color: v.codeTab ? '#FFFFFF' : '#0E1F19', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.pickCode} selected={v.codeTab}>
              <DC.T>{"My invite code"}</DC.T>
            </DC.Box>
            <DC.Box s={{ minHeight: 48, borderRadius: 14, backgroundColor: !v.codeTab ? '#0B6E4F' : '#FFFFFF', color: !v.codeTab ? '#FFFFFF' : '#0E1F19', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.pickPeople} selected={!v.codeTab}>
              <DC.T>{"People I invited"}</DC.T>
            </DC.Box>
          </DC.Box>
          {v.codeTab ? (
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              <DC.Box s={{ paddingTop: 22, paddingRight: 16, paddingBottom: 22, paddingLeft: 16, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 8, columnGap: 8 }}>
                <DC.T s={{ fontSize: 14, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{"My code"}</DC.T>
                <DC.T s={{ fontSize: 36, fontWeight: '800', letterSpacing: 2 }}>{v.code}</DC.T>
              </DC.Box>
              {v.shareMsg ? (
                <DC.Box s={{ paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#E9EEEB' }}>
                  <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#33453D', _lhMul: 1.35 }}>{v.shareMsg}</DC.T>
                </DC.Box>
              ) : null}
              <DC.Box s={{ minHeight: 56, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.share} disabled={!v.hasCode}>
                <DC.T>{"Share with a friend"}</DC.T>
              </DC.Box>
              <DC.Box s={DC.css(`min-height: 56px; border: 3px solid #0B6E4F; border-radius: 18px; background: ${DC.S(v.copyBg)}; color: ${DC.S(v.copyInk)}; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center`)} kind="button" onPress={v.copy} disabled={!v.hasCode} label={v.copyLabel}>
                <DC.T>{v.copyLabel}</DC.T>
              </DC.Box>
            </DC.Box>
          ) : (
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              <DC.Box s={{ paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 20, backgroundColor: '#FFFFFF' }}>
                <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{v.joinedText}</DC.T>
              </DC.Box>
              {v.emptyPeople ? (
                <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F' }}>{"When friends join with my code, they show here."}</DC.T>
              ) : (
                DC.list(v.people).map((row, $i) => (
                  <DC.Box key={$i} s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                    <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{row.title}</DC.T>
                    <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#46574F' }}>{row.note}</DC.T>
                  </DC.Box>
                ))
              )}
            </DC.Box>
          )}
        </DC.Box>
      </DC.Box>
    );
  }
}
