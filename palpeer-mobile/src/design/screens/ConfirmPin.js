// Confirm it's you — Face/Fingerprint or PIN; email OTP when another device already owns the account.
/* eslint-disable */
import React from 'react';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'choose', // choose | pin | otp
      pin: '',
      ecode: '',
      wrong: false,
      tries: 0,
      busy: false,
      speaking: false,
      resendLeft: 0,
    };
    this._resendTimer = null;
  }

  componentDidUpdate(prevProps) {
    if (this.props.needsOtp && !prevProps.needsOtp && this.state.mode !== 'otp') {
      this.setState({ mode: 'otp', wrong: false, busy: false, ecode: '' });
      this.startResendCooldown(45);
    }
  }

  componentWillUnmount() {
    if (this._resendTimer) clearInterval(this._resendTimer);
  }

  startResendCooldown(seconds) {
    const left = Math.max(0, Number(seconds) || 0);
    this.setState({ resendLeft: left });
    if (this._resendTimer) clearInterval(this._resendTimer);
    if (left <= 0) return;
    this._resendTimer = setInterval(() => {
      this.setState((s) => {
        const next = Math.max(0, (s.resendLeft || 0) - 1);
        if (next <= 0 && this._resendTimer) {
          clearInterval(this._resendTimer);
          this._resendTimer = null;
        }
        return { resendLeft: next };
      });
    }, 1000);
  }

  handleUnlockResult(r) {
    if (r && r.ok) {
      if (r.needsOtp) {
        this.setState({ mode: 'otp', busy: false, wrong: false, ecode: '' });
        this.startResendCooldown(r.cooldownSec || 45);
        return;
      }
      return;
    }
    this.setState({ busy: false, wrong: true });
  }

  async unlockBio() {
    if (this.state.busy) return;
    if (this.props.clearError) this.props.clearError();
    this.setState({ busy: true, wrong: false });
    try {
      if (this.props.backend && this.props.onUnlockBio) {
        const r = await this.props.onUnlockBio();
        this.handleUnlockResult(r);
        return;
      }
      this.setState({ busy: false });
    } catch (e) {
      this.setState({ busy: false, wrong: true });
    }
  }

  async press(digit) {
    if (this.state.busy || this.state.tries >= 3) return;
    const pin = this.state.pin + digit;
    if (pin.length < 4) {
      this.setState({ pin, wrong: false });
      return;
    }
    this.setState({ busy: true, pin, wrong: false });
    try {
      if (this.props.backend && this.props.confirmPin) {
        const r = await this.props.confirmPin(pin);
        if (r && r.ok) {
          this.handleUnlockResult(r);
          if (!r.needsOtp) return;
          this.setState({ pin: '' });
          return;
        }
        this.setState({
          pin: '',
          wrong: true,
          busy: false,
          tries: this.state.tries + 1,
        });
        return;
      }
      this.setState({ pin: '', wrong: false, busy: false });
    } catch (e) {
      this.setState({ pin: '', wrong: true, busy: false, tries: this.state.tries + 1 });
    }
  }

  async submitCode(code) {
    if (this.state.busy || String(code || '').length < 6) return;
    this.setState({ busy: true, wrong: false });
    try {
      if (this.props.backend && this.props.onVerifyCode) {
        const r = await this.props.onVerifyCode(code);
        if (r && r.ok) return;
        this.setState({ ecode: '', wrong: true, busy: false });
        return;
      }
      this.setState({ ecode: '', wrong: false, busy: false });
    } catch (e) {
      this.setState({ ecode: '', wrong: true, busy: false });
    }
  }

  async resend() {
    if (this.state.busy || this.state.resendLeft > 0) return;
    if (!this.props.backend || !this.props.onSendCode) return;
    if (this.props.clearError) this.props.clearError();
    this.setState({ busy: true, wrong: false });
    try {
      const r = await this.props.onSendCode();
      this.setState({ busy: false, wrong: !(r && r.ok) });
      if (r && r.ok) this.startResendCooldown(r.cooldownSec || 45);
    } catch (e) {
      this.setState({ busy: false, wrong: true });
    }
  }

  renderVals() {
    const { mode, pin, ecode, wrong, tries, busy, resendLeft } = this.state;
    const backend = !!this.props.backend;
    const apiError = backend ? this.props.error || '' : '';
    const showWrong = wrong || !!apiError;
    const bioLabel = this.props.bioLabel || 'Face or Fingerprint';
    const showBio = this.props.bioAvailable !== false;
    const locked = tries >= 3 && mode !== 'otp';
    const otpMode = mode === 'otp' || !!this.props.needsOtp;
    const mailMask = this.props.mailMask || 'your email';
    const digits = String(ecode || '').replace(/\D/g, '').slice(0, 6);
    const codeReady = digits.length === 6 && !busy;
    const helpText = otpMode
      ? showWrong
        ? apiError || 'That code did not work. Try again, or resend.'
        : 'Another device is signed in. Enter the 6 numbers we emailed you to continue on this phone.'
      : mode === 'pin'
        ? showWrong
          ? apiError ||
            'Wrong PIN. ' + (3 - tries) + (tries === 2 ? ' try left.' : ' tries left.')
          : '4 numbers, or use Face or Fingerprint'
        : showWrong
          ? apiError || "We couldn't confirm it's you. Try again, or use your PIN."
          : 'This looks like a new device. Unlock with Face or Fingerprint or your PIN.';
    return {
      isChoose: mode === 'choose' && !locked && !otpMode,
      isPin: mode === 'pin' && !locked && !otpMode,
      isOtp: otpMode && !locked,
      locked,
      helpText,
      helpColor: showWrong ? '#B3231A' : '#33453D',
      hasAuthMsg: showWrong,
      authMsg: showWrong
        ? apiError ||
          (otpMode
            ? 'That code did not work. Try again, or resend.'
            : mode === 'pin'
              ? 'Wrong PIN. Try again.'
              : "We couldn't confirm it's you. Try again, or use your PIN.")
        : '',
      showBio,
      bioLabel,
      unlockBio: () => this.unlockBio(),
      unlockBioLabel: busy && mode === 'choose' ? 'Checking…' : `Unlock with ${bioLabel}`,
      bioBusy: busy,
      usePin: () => {
        if (this.props.clearError) this.props.clearError();
        this.setState({ mode: 'pin', pin: '', wrong: false });
      },
      backToChoose: () => {
        if (this.props.clearError) this.props.clearError();
        this.setState({ mode: 'choose', pin: '', wrong: false, busy: false });
      },
      dots: [0, 1, 2, 3].map((i) => ({ bg: i < pin.length ? '#0E1F19' : 'transparent' })),
      pinLabel: pin.length + ' of 4 numbers entered',
      pinText: helpText,
      pinColor: showWrong ? '#B3231A' : '#33453D',
      keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => ({
        label: k,
        press: () => this.press(k),
      })),
      press0: () => this.press('0'),
      erase: () => {
        if (busy) return;
        this.setState({ pin: pin.slice(0, -1), wrong: false });
      },
      useFinger: () => this.unlockBio(),
      mailMask,
      ecode: digits,
      setEcode: (v) => {
        if (busy) return;
        if (this.props.clearError) this.props.clearError();
        const next = String(v || '').replace(/\D/g, '').slice(0, 6);
        this.setState({ ecode: next, wrong: false }, () => {
          if (next.length === 6) setTimeout(() => this.submitCode(next), 120);
        });
      },
      codeBg: codeReady ? '#0B6E4F' : '#9BB5AB',
      codeBlocked: !codeReady,
      finishCode: () => this.submitCode(digits),
      resend: () => this.resend(),
      resendOff: busy || resendLeft > 0,
      resendText: resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend code',
      resendColor: resendLeft > 0 ? '#6B7C74' : '#0B6E4F',
      listen: () =>
        this.listen(
          otpMode ? helpText + ' Sent to ' + mailMask + '.' : helpText,
        ),
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      goReset: () => {
        if (this.props.goPinReset) this.props.goPinReset();
      },
      goHome: () => {
        if (this.props.goHome) this.props.goHome();
      },
    };
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
      u.onend = () => this.setState({ speaking: false });
      this.setState({ speaking: true });
      s.speak(u);
    } catch (e) {
      this.setState({ speaking: false });
    }
  }
}

export default class ConfirmPinScreen extends Component {
  static defaultProps = {};
  static title = "Confirm it's you";
  static background = '#F3F6F4';

  render() {
    const v = this.renderVals() || {};
    return (
      <DC.Box s={{ position: 'relative', backgroundColor: '#F3F6F4', color: '#0E1F19', fontFamily: "'Noto Sans', system-ui, sans-serif", overflow: 'hidden', flex: 1 }}>
        {v.isChoose ? (<>
          <DC.StickyTop s={{ _display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 52 }}>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label={`Listen to this screen`}>
              <DC.Icon w={26} h={26} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.200'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M4 9.500v5h3.500L13 19V5L7.500 9.500H4z'} fill={'currentColor'} /><SVG.Path d={'M16.500 9a4.500 4.500 0 0 1 0 6'} /><SVG.Path d={'M19 6.500a8 8 0 0 1 0 11'} /></DC.Icon>
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.StickyTop>
          <DC.Box s={{ paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14, flex: 1 }}>
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 12, columnGap: 12, textAlign: 'center' }}>
              <DC.Box s={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#0E1F19', color: '#FFFFFF', _display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DC.Icon w={52} h={52} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.4'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Rect x={'5'} y={'11'} width={'14'} height={'10'} rx={'2'} /><SVG.Path d={'M8 11V7a4 4 0 0 1 8 0v4'} /></DC.Icon>
              </DC.Box>
              <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, _lhMul: 1.15 }} role="header">{"Confirm it's you"}</DC.T>
              <DC.T s={{ fontSize: 18, _lhMul: 1.3, fontWeight: '600', color: '#33453D' }}>{"This looks like a new device. Unlock with Face or Fingerprint or your PIN."}</DC.T>
            </DC.Box>
            {v.hasAuthMsg ? (
              <DC.T s={{ flexShrink: 0, fontSize: 17, _lhMul: 1.3, fontWeight: '700', color: '#B3231A', textAlign: 'center' }} role="alert">{v.authMsg}</DC.T>
            ) : null}
            <DC.Box s={{ marginTop: 'auto', flexShrink: 0, _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              {v.showBio ? (
                <DC.Box s={{ flexShrink: 0, minHeight: 60, borderWidth: 3, borderColor: '#0B6E4F', borderStyle: 'solid', borderRadius: 20, backgroundColor: 'transparent', color: '#0B6E4F', fontSize: 18, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.unlockBio} disabled={v.bioBusy} label={v.unlockBioLabel}>
                  <DC.T>{v.unlockBioLabel}</DC.T>
                </DC.Box>
              ) : null}
              <DC.Box s={{ flexShrink: 0, minHeight: 68, borderWidth: 0, borderRadius: 20, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 22, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.usePin} disabled={v.bioBusy} label={`Use my PIN`}>
                <DC.T>{"Use my PIN"}</DC.T>
              </DC.Box>
            </DC.Box>
          </DC.Box>
        </>) : null}
        {v.isPin ? (<>
          <DC.StickyTop s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, rowGap: 12, columnGap: 12 }}>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 10, borderWidth: 0, borderRadius: 26, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 6, columnGap: 6 }} kind="button" onPress={v.backToChoose}>
              <DC.Icon w={26} h={26} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.600'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M20 12H5M11 6l-6 6 6 6'} /></DC.Icon>
              <DC.T>{"Back"}</DC.T>
            </DC.Box>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label={`Listen to this screen`}>
              <DC.Icon w={26} h={26} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.200'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M4 9.500v5h3.500L13 19V5L7.500 9.500H4z'} fill={'currentColor'} /><SVG.Path d={'M16.500 9a4.500 4.500 0 0 1 0 6'} /><SVG.Path d={'M19 6.500a8 8 0 0 1 0 11'} /></DC.Icon>
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.StickyTop>
          <DC.Box s={{ height: 844, paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14 }}>
            <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, _lhMul: 1.15 }} role="header">{"Enter your PIN"}</DC.T>
            <DC.Box s={{ backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 12, columnGap: 12 }} label={`PIN`}>
              <DC.Box s={{ _display: 'flex', justifyContent: 'center', rowGap: 18, columnGap: 18 }} label={v.pinLabel} role="img">
                {DC.list(v.dots).map((d, $index) => (<React.Fragment key={$index}>
                  <DC.Box s={DC.css(`width: 26px; height: 26px; box-sizing: border-box; border-radius: 13px; border: 3px solid #0E1F19; background: ${DC.S(d?.bg)}`)} />
                </React.Fragment>))}
              </DC.Box>
              <DC.T s={DC.css(`font-size: 17px; line-height: 1.3; font-weight: 700; color: ${DC.S(v.pinColor)}`)} live="polite">{v.pinText}</DC.T>
            </DC.Box>
            <DC.Box s={{ marginTop: 'auto', _display: 'grid', _cols: 3, rowGap: 10, columnGap: 10 }}>
              {DC.list(v.keys).map((k, $index) => (<React.Fragment key={$index}>
                <DC.Box s={{ height: 80, borderWidth: 0, borderRadius: 18, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 34, fontWeight: '800' }} kind="button" onPress={k?.press}>
                  <DC.T>{k?.label}</DC.T>
                </DC.Box>
              </React.Fragment>))}
            </DC.Box>
            <DC.Box s={{ _display: 'grid', _cols: 3, rowGap: 10, columnGap: 10 }}>
              {v.showBio ? (
                <DC.Box s={{ height: 80, borderWidth: 0, borderRadius: 18, backgroundColor: '#0B6E4F', color: '#FFFFFF', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.useFinger} label={`Unlock with ${DC.S(v.bioLabel)}`}>
                  <DC.Icon w={46} h={46} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M4.500 10a8 8 0 0 1 15 0'} /><SVG.Path d={'M6.500 20a14 14 0 0 0 1-6.500 4.500 4.500 0 0 1 9 0c0 2.500-.3 4.800-1 7'} /><SVG.Path d={'M12 13.500c0 3.500-.6 6-1.800 8'} /><SVG.Path d={'M19.800 15c-.1 1.500-.3 2.900-.7 4.200'} /></DC.Icon>
                </DC.Box>
              ) : (
                <DC.Box s={{ height: 80 }} />
              )}
              <DC.Box s={{ height: 80, borderWidth: 0, borderRadius: 18, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 34, fontWeight: '800' }} kind="button" onPress={v.press0}>
                <DC.T>{"0"}</DC.T>
              </DC.Box>
              <DC.Box s={{ height: 80, borderWidth: 0, borderRadius: 18, backgroundColor: '#E9EEEB', color: '#0E1F19', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.erase} label={`Remove the last number`}>
                <DC.Icon w={38} h={38} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.400'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z'} /><SVG.Path d={'M12 9.500l5 5M17 9.500l-5 5'} /></DC.Icon>
              </DC.Box>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, minHeight: 44, color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.goReset}>
              <DC.T>{"I forgot my PIN"}</DC.T>
            </DC.Box>
          </DC.Box>
        </>) : null}
        {v.isOtp ? (<>
          <DC.StickyTop s={{ _display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 52 }}>
            <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label={`Listen to this screen`}>
              <DC.Icon w={26} h={26} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.200'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Path d={'M4 9.500v5h3.500L13 19V5L7.500 9.500H4z'} fill={'currentColor'} /><SVG.Path d={'M16.500 9a4.500 4.500 0 0 1 0 6'} /><SVG.Path d={'M19 6.500a8 8 0 0 1 0 11'} /></DC.Icon>
              <DC.T>{v.listenLabel}</DC.T>
            </DC.Box>
          </DC.StickyTop>
          <DC.Box s={{ paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14, flex: 1 }}>
            <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, _lhMul: 1.15 }} role="header">{"Confirm it's you"}</DC.T>
            <DC.T s={{ marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, fontSize: 18, _lhMul: 1.3, fontWeight: '600', color: '#33453D' }}>{"This device is already registered. We sent 6 numbers to "}{v.mailMask}{"."}</DC.T>
            <DC.Box s={{ backgroundColor: '#FFFFFF', borderRadius: 20, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
              <DC.T s={{ fontSize: 17, fontWeight: '700' }}>{"6-number code"}</DC.T>
              <DC.Input s={{ width: '100%', minHeight: 68, borderWidth: 0, borderRadius: 14, backgroundColor: '#E9EEEB', color: '#0E1F19', textAlign: 'center', fontSize: 32, fontWeight: '800', letterSpacing: 10 }} value={v.ecode} onChange={v.setEcode} inputMode={'numeric'} autoComplete={'one-time-code'} id={'new-device-ecode'} />
              <DC.Box s={DC.css(`min-height: 48px; border: 0; background: transparent; color: ${DC.S(v.resendColor)}; font-size: 17px; font-weight: 800`)} kind="button" onPress={v.resend} disabled={v.resendOff}>
                <DC.T>{v.resendText}</DC.T>
              </DC.Box>
            </DC.Box>
            <DC.T s={DC.css(`font-size: 17px; line-height: 1.3; font-weight: 700; text-align: center; color: ${DC.S(v.helpColor)}`)} live="polite">{v.helpText}</DC.T>
            {v.hasAuthMsg ? (
              <DC.T s={{ flexShrink: 0, fontSize: 17, _lhMul: 1.3, fontWeight: '700', color: '#B3231A' }} role="alert">{v.authMsg}</DC.T>
            ) : null}
            <DC.Box s={DC.css(`margin-top: auto; min-height: 68px; flex-shrink: 0; border: 0; border-radius: 20px; font-size: 22px; font-weight: 800; background: ${DC.S(v.codeBg)}; color: #FFFFFF`)} kind="button" onPress={v.finishCode} disabled={v.codeBlocked}>
              <DC.T>{"Continue"}</DC.T>
            </DC.Box>
          </DC.Box>
        </>) : null}
        {v.locked ? (<>
          <DC.Box s={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 26, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, backgroundColor: '#F3F6F4', _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14 }}>
            <DC.Box s={{ _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 12, columnGap: 12, textAlign: 'center' }}>
              <DC.Box s={{ width: 92, height: 92, borderRadius: 46, backgroundColor: '#B3231A', color: '#FFFFFF', _display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DC.Icon w={52} h={52} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={'2.4'} strokeLinecap={'round'} strokeLinejoin={'round'}><SVG.Rect x={'5'} y={'11'} width={'14'} height={'10'} rx={'2'} /><SVG.Path d={'M8 11V7a4 4 0 0 1 8 0v4'} /></DC.Icon>
              </DC.Box>
              <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, _lhMul: 1.15 }} role="header">{"My PIN is locked"}</DC.T>
              <DC.T s={{ fontSize: 18, _lhMul: 1.3, fontWeight: '600', color: '#33453D' }}>{"Wrong PIN 3 times. Reset your PIN to continue on this device."}</DC.T>
            </DC.Box>
            <DC.Box s={{ marginTop: 'auto', flexShrink: 0, minHeight: 68, borderRadius: 20, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 22, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.goReset}>
              <DC.T>{"Reset my PIN"}</DC.T>
            </DC.Box>
            <DC.Box s={{ flexShrink: 0, minHeight: 60, borderWidth: 3, borderColor: '#0B6E4F', borderStyle: 'solid', borderRadius: 20, color: '#0B6E4F', fontSize: 20, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.goHome}>
              <DC.T>{"Go home"}</DC.T>
            </DC.Box>
          </DC.Box>
        </>) : null}
      </DC.Box>
    );
  }
}
