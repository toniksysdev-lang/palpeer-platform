// Notification settings — design UI for push on this phone and other devices.
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
    const devices = Array.isArray(p.otherDevices) ? p.otherDevices : [];
    const enabled = !!p.enabledHere;
    const removing = p.removingId
      ? devices.find((d) => d.id === p.removingId) || { title: 'that device' }
      : null;
    return {
      loading: !!p.loading,
      hasLoadError: !!p.loadError,
      loadError: p.loadError || '',
      enabled,
      pushNote: p.pushNote || '',
      busy: !!p.busy,
      error: p.error || '',
      hasError: !!p.error,
      blocked: !!p.blocked,
      devices,
      hasDevices: devices.length > 0,
      removing,
      confirmRemove: !!removing,
      removeBusy: !!p.removeBusy,
      toggle: () => (p.onToggleThisPhone ? void p.onToggleThisPhone() : null),
      askRemove: (id) => (p.onAskRemoveDevice ? p.onAskRemoveDevice(id) : null),
      cancelRemove: () => (p.onCancelRemove ? p.onCancelRemove() : null),
      confirmRemoveDo: () => (p.onConfirmRemove ? void p.onConfirmRemove() : null),
      openPhone: () => (p.onOpenPhoneSettings ? p.onOpenPhoneSettings() : null),
      retry: () => (p.onRetry ? p.onRetry() : null),
      back: () => (p.onBack ? p.onBack() : null),
      ring: enabled ? '#0B6E4F' : 'transparent',
      statusLabel: enabled ? 'On' : 'Off',
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen(
        'Notification settings. Push notifications on this phone. ' +
        (enabled ? 'On. ' : 'Off. ') +
        (p.pushNote || '') + '. ' +
        (devices.length
          ? 'Other devices. ' + devices.map((d) => d.title + '. ' + d.note).join('. ')
          : 'No other devices.')
      ),
    };
  }
}

export default class NotificationSettingsScreen extends Component {
  static defaultProps = {};
  static title = 'Notification settings';
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

          <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, _lhMul: 1.15 }} role="header">{"Notification settings"}</DC.T>
          <DC.T s={{ marginTop: 0, marginBottom: 0, fontSize: 17, _lhMul: 1.3, fontWeight: '600', color: '#33453D' }}>{"Choose what my phone tells me."}</DC.T>

          {v.loading ? (<>
            <DC.Box s={{ flexShrink: 0, minHeight: 76, borderRadius: 18, backgroundColor: '#FFFFFF' }} />
            <DC.Box s={{ flexShrink: 0, minHeight: 76, borderRadius: 18, backgroundColor: '#FFFFFF' }} />
          </>) : null}

          {v.hasLoadError ? (<>
            <DC.Box s={{ flexShrink: 0, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FCE8E6' }}>
              <DC.T s={{ fontSize: 17, fontWeight: '700', color: '#B3231A' }}>{v.loadError}</DC.T>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.retry}>
              <DC.T>{"Try again"}</DC.T>
            </DC.Box>
          </>) : null}

          {!v.loading && !v.hasLoadError ? (<>
            <DC.Box s={DC.css(`flex-shrink: 0; min-height: 76px; box-sizing: border-box; padding: 10px 16px; border: 3px solid ${DC.S(v.ring)}; border-radius: 18px; background: #FFFFFF; color: #0E1F19; text-align: left; display: flex; flex-direction: column; justify-content: center; gap: 2px`)} kind="button" onPress={v.toggle} disabled={v.busy} selected={v.enabled ? 'true' : 'false'} label="Push notifications on this phone">
              <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 8, columnGap: 8 }}>
                <DC.T s={{ fontSize: 20, _lhMul: 1.2, fontWeight: '800', flexShrink: 1 }}>{"Push on this phone"}</DC.T>
                <DC.T s={{ fontSize: 16, fontWeight: '800', color: v.enabled ? '#0B6E4F' : '#5B6B64' }}>{v.busy ? '…' : v.statusLabel}</DC.T>
              </DC.Box>
              <DC.T s={{ fontSize: 16, _lhMul: 1.3, fontWeight: '600', color: '#46574F' }}>{v.pushNote}</DC.T>
            </DC.Box>

            {v.hasError ? (<>
              <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FCE8E6' }}>
                <DC.T s={{ fontSize: 16, fontWeight: '700', color: '#B3231A' }}>{v.error}</DC.T>
              </DC.Box>
            </>) : null}

            {v.blocked ? (<>
              <DC.Box s={{ flexShrink: 0, minHeight: 56, borderWidth: 3, borderColor: '#0E1F19', borderStyle: 'solid', borderRadius: 18, backgroundColor: 'transparent', color: '#0E1F19', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.openPhone}>
                <DC.T>{"Open phone settings"}</DC.T>
              </DC.Box>
            </>) : null}

            <DC.Box s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#DDF1E7' }}>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#075E45' }}>{"Money alerts and chat still show in Messages even when push is off."}</DC.T>
            </DC.Box>

            {v.hasDevices ? (<>
              <DC.T s={{ fontSize: 22, fontWeight: '800' }}>{"Other devices"}</DC.T>
              {DC.list(v.devices).map((d, $i) => (
                <DC.Box key={d.id || $i} s={{ flexShrink: 0, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderRadius: 18, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 8, columnGap: 8 }}>
                  <DC.T s={{ fontSize: 18, fontWeight: '800' }}>{d.title}</DC.T>
                  <DC.T s={{ fontSize: 15, fontWeight: '600', color: '#46574F' }}>{d.note}</DC.T>
                  <DC.Box s={{ alignSelf: 'flex-start', minHeight: 44, paddingTop: 0, paddingRight: 14, paddingBottom: 0, paddingLeft: 14, borderRadius: 14, backgroundColor: '#F3F6F4', color: '#B3231A', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={() => v.askRemove(d.id)} label={`Remove ${d.title}`}>
                    <DC.T>{"Remove"}</DC.T>
                  </DC.Box>
                </DC.Box>
              ))}
            </>) : null}
          </>) : null}
        </DC.Box>

        {v.confirmRemove ? (<>
          <DC.Box s={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(14,31,25,0.45)', _display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', paddingTop: 16, paddingRight: 16, paddingBottom: 24, paddingLeft: 16 }}>
            <DC.Box s={{ width: '100%', paddingTop: 18, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, borderRadius: 22, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              <DC.T s={{ fontSize: 24, fontWeight: '800' }}>{"Stop notifications on that device?"}</DC.T>
              <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F' }}>{"It will not get push alerts until turned on again from that device."}</DC.T>
              <DC.Box s={{ flexShrink: 0, minHeight: 56, borderRadius: 18, backgroundColor: '#B3231A', color: '#FFFFFF', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.confirmRemoveDo} disabled={v.removeBusy}>
                <DC.T>{v.removeBusy ? 'Removing…' : 'Remove'}</DC.T>
              </DC.Box>
              <DC.Box s={{ flexShrink: 0, minHeight: 52, borderRadius: 18, backgroundColor: '#F3F6F4', color: '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.cancelRemove}>
                <DC.T>{"Cancel"}</DC.T>
              </DC.Box>
            </DC.Box>
          </DC.Box>
        </>) : null}
      </DC.Box>
    );
  }
}
