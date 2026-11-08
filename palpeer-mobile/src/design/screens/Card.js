// Card — design UI for virtual card detail, freeze/unfreeze, and card history.
/* eslint-disable */
import React from 'react';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { speaking: false, confirm: null };
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
    const loading = !!p.loading;
    const error = p.error || '';
    const detailRows = Array.isArray(p.detailRows) ? p.detailRows : [];
    const transactions = Array.isArray(p.transactions) ? p.transactions : [];
    const confirm = this.state.confirm;
    return {
      loading,
      error,
      hasError: !!error,
      headline: p.headline || 'My card',
      statusLabel: p.statusLabel || '',
      faceLine: p.faceLine || '',
      currencyLine: p.currencyLine || '',
      detailRows,
      testNotice: p.testNotice || '',
      hasTestNotice: !!p.testNotice,
      fundingNotice: p.fundingNotice || '',
      canFreeze: !!p.canFreeze,
      canUnfreeze: !!p.canUnfreeze,
      freezeBusy: !!p.freezeBusy,
      unfreezeBusy: !!p.unfreezeBusy,
      transactions,
      txEmpty: !!p.txEmpty,
      txLoading: !!p.txLoading,
      txError: p.txError || '',
      hasTxError: !!p.txError,
      hasMore: !!p.hasMore,
      loadingMore: !!p.loadingMore,
      confirmFreeze: confirm === 'freeze',
      confirmUnfreeze: confirm === 'unfreeze',
      askFreeze: () => this.setState({ confirm: 'freeze' }),
      askUnfreeze: () => this.setState({ confirm: 'unfreeze' }),
      cancelConfirm: () => this.setState({ confirm: null }),
      doFreeze: () => {
        this.setState({ confirm: null });
        if (p.onFreeze) void p.onFreeze();
      },
      doUnfreeze: () => {
        this.setState({ confirm: null });
        if (p.onUnfreeze) void p.onUnfreeze();
      },
      more: () => (p.onLoadMore ? p.onLoadMore() : null),
      back: () => (p.onBack ? p.onBack() : null),
      retry: () => (p.onRetry ? p.onRetry() : null),
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen(
        (p.headline || 'My card') + '. ' +
        (p.statusLabel || '') + '. ' +
        (p.faceLine || '') + '. ' +
        detailRows.map((r) => r.label + ' ' + r.value).join('. ') + '.'
      ),
    };
  }
}

export default class CardScreen extends Component {
  static defaultProps = {};
  static title = 'My card';
  static background = '#F3F6F4';

  render() {
    const v = this.renderVals() || {};
    return (
      <DC.Box s={{ position: 'relative', backgroundColor: '#F3F6F4', color: '#0E1F19', fontFamily: "'Noto Sans', system-ui, sans-serif", _display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <DC.Box s={{ flexGrow: 1, minHeight: 0, paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14, _scroll: 'y' }}>
          <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 12, minHeight: 52 }}>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 10, borderWidth: 0, borderRadius: 26, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 6, columnGap: 6 }} kind="button" onPress={v.back}>
              <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M20 12H5M11 6l-6 6 6 6" /></DC.Icon>
              <DC.T>{"Back"}</DC.T>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label="Listen to this screen">
              <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M4 9.500v5h3.500L13 19V5L7.500 9.500H4z" fill="currentColor" /><SVG.Path d="M16.500 9a4.500 4.500 0 0 1 0 6" /><SVG.Path d="M19 6.500a8 8 0 0 1 0 11" /></DC.Icon>
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.Box>

          <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, _lhMul: 1.15 }} role="header">{v.headline}</DC.T>

          {v.loading ? (<>
            <DC.Box s={{ flexShrink: 0, minHeight: 140, borderRadius: 20, backgroundColor: '#FFFFFF' }} />
            <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: '#FFFFFF' }} />
          </>) : null}

          {v.hasError ? (<>
            <DC.Box s={{ flexShrink: 0, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FCE8E6' }}>
              <DC.T s={{ fontSize: 17, fontWeight: '700', color: '#B3231A' }}>{v.error}</DC.T>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.retry}>
              <DC.T>{"Try again"}</DC.T>
            </DC.Box>
          </>) : null}

          {!v.loading && !v.hasError ? (<>
            <DC.Box s={{ flexShrink: 0, minHeight: 140, paddingTop: 18, paddingRight: 18, paddingBottom: 18, paddingLeft: 18, borderRadius: 22, backgroundColor: '#1D5BC7', color: '#FFFFFF', _display: 'flex', flexDirection: 'column', justifyContent: 'space-between', rowGap: 12, columnGap: 12 }}>
              <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8 }}>
                <DC.T s={{ fontSize: 16, fontWeight: '700', color: '#D6E4FA' }}>{v.currencyLine}</DC.T>
                <DC.T s={{ fontSize: 14, fontWeight: '800', paddingTop: 4, paddingRight: 10, paddingBottom: 4, paddingLeft: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' }}>{v.statusLabel}</DC.T>
              </DC.Box>
              <DC.T s={{ fontSize: 26, fontWeight: '800', letterSpacing: 1.2 }}>{v.faceLine}</DC.T>
            </DC.Box>

            {v.canFreeze ? (<>
              <DC.Box s={{ flexShrink: 0, minHeight: 56, borderWidth: 3, borderColor: '#0E1F19', borderStyle: 'solid', borderRadius: 18, backgroundColor: 'transparent', color: '#0E1F19', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.askFreeze} disabled={v.freezeBusy}>
                <DC.T>{v.freezeBusy ? 'Freezing…' : 'Freeze card'}</DC.T>
              </DC.Box>
            </>) : null}
            {v.canUnfreeze ? (<>
              <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.askUnfreeze} disabled={v.unfreezeBusy}>
                <DC.T>{v.unfreezeBusy ? 'Unfreezing…' : 'Unfreeze card'}</DC.T>
              </DC.Box>
            </>) : null}

            <DC.Box s={{ flexShrink: 0, paddingTop: 6, paddingRight: 14, paddingBottom: 6, paddingLeft: 14, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column' }}>
              {DC.list(v.detailRows).map((r, $i) => (
                <DC.Box key={$i} s={{ paddingTop: 12, paddingBottom: 12, borderBottomWidth: $i === v.detailRows.length - 1 ? 0 : 1, borderBottomColor: '#E5EBE8', borderBottomStyle: 'solid', _display: 'flex', flexDirection: 'column', rowGap: 2, columnGap: 2 }}>
                  <DC.T s={{ fontSize: 14, fontWeight: '700', color: '#5B6B64' }}>{r.label}</DC.T>
                  <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{r.value}</DC.T>
                </DC.Box>
              ))}
            </DC.Box>

            {v.hasTestNotice ? (<>
              <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#E1ECFB' }}>
                <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#1D5BC7' }}>{v.testNotice}</DC.T>
              </DC.Box>
            </>) : null}
            <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#DDF1E7' }}>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#075E45' }}>{v.fundingNotice}</DC.T>
            </DC.Box>

            <DC.T s={{ fontSize: 22, fontWeight: '800' }}>{"Card history"}</DC.T>

            {v.txLoading ? (<>
              <DC.Box s={{ flexShrink: 0, minHeight: 64, borderRadius: 18, backgroundColor: '#FFFFFF' }} />
            </>) : null}
            {v.hasTxError ? (<>
              <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FCE8E6' }}>
                <DC.T s={{ fontSize: 16, fontWeight: '700', color: '#B3231A' }}>{v.txError}</DC.T>
              </DC.Box>
            </>) : null}
            {v.txEmpty ? (<>
              <DC.Box s={{ flexShrink: 0, paddingTop: 20, paddingBottom: 8, _display: 'flex', flexDirection: 'column', rowGap: 6, columnGap: 6 }}>
                <DC.T s={{ fontSize: 20, fontWeight: '800' }}>{"No card payments yet"}</DC.T>
                <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F' }}>{"Payments made with this card show here."}</DC.T>
              </DC.Box>
            </>) : null}
            {DC.list(v.transactions).map((tx, $i) => (
              <DC.Box key={tx.id || $i} s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8 }}>
                  <DC.T s={{ fontSize: 18, fontWeight: '800', flexShrink: 1 }}>{tx.title}</DC.T>
                  <DC.T s={{ fontSize: 18, fontWeight: '800', color: tx.credit ? '#0B6E4F' : '#0E1F19' }}>{tx.amountLabel}</DC.T>
                </DC.Box>
                <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#5B6B64' }}>{tx.note}</DC.T>
                <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#46574F' }}>{tx.statusLabel}</DC.T>
              </DC.Box>
            ))}
            {v.hasMore ? (<>
              <DC.Box s={{ flexShrink: 0, minHeight: 52, borderRadius: 18, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.more} disabled={v.loadingMore}>
                <DC.T>{v.loadingMore ? 'Loading…' : 'Load more'}</DC.T>
              </DC.Box>
            </>) : null}
          </>) : null}
        </DC.Box>

        {v.confirmFreeze || v.confirmUnfreeze ? (<>
          <DC.Box s={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,31,25,0.45)', _display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingTop: 16, paddingRight: 16, paddingBottom: 24, paddingLeft: 16 }}>
            <DC.Box s={{ width: '100%', paddingTop: 18, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, borderRadius: 22, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              <DC.T s={{ fontSize: 24, fontWeight: '800' }}>{v.confirmFreeze ? 'Freeze this card?' : 'Unfreeze this card?'}</DC.T>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F' }}>{v.confirmFreeze ? 'The card stays frozen until you unfreeze it. You can do that at any time.' : 'The card will be active again.'}</DC.T>
              <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: v.confirmFreeze ? '#B3231A' : '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.confirmFreeze ? v.doFreeze : v.doUnfreeze}>
                <DC.T>{v.confirmFreeze ? 'Freeze card' : 'Unfreeze card'}</DC.T>
              </DC.Box>
              <DC.Box s={{ flexShrink: 0, minHeight: 52, borderRadius: 18, backgroundColor: '#F3F6F4', color: '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.cancelConfirm}>
                <DC.T>{"Cancel"}</DC.T>
              </DC.Box>
            </DC.Box>
          </DC.Box>
        </>) : null}
      </DC.Box>
    );
  }
}
