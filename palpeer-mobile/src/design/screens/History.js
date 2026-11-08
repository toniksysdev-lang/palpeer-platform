// History — design UI with stats, filters, full detail, save image/PDF.
/* eslint-disable */
import React from 'react';
import { View } from 'react-native';
import * as SVG from 'react-native-svg';
import * as DC from '../dc/runtime';

const DCLogic = DC.DCLogic;

const SWAP = 'M3 8h17M15 3l5 5-5 5M21 16H4M9 11l-5 5 5 5';
const PEOPLE = 'M9 8m-3.600 0a3.600 3.600 0 1 0 7.200 0a3.600 3.600 0 1 0-7.200 0M2.500 20c0-3.600 2.800-6 6.500-6s6.500 2.400 6.500 6M15.500 4.700a3.600 3.600 0 0 1 0 6.600M18 14.600c2.100.8 3.500 2.800 3.500 5.400';
const SEND = 'M9 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M2 21c0-4 3-6.500 7-6.500s7 2.500 7 6.500M16 11h6M19 8l3 3-3 3';
const BANK = 'M3 10l9-6 9 6zM6 10v8M12 10v8M18 10v8M3 21h18';
const PLUS = 'M12 4v16M4 12h16';
const ITEMS = [
  { key: 's0', type: 'FUNDING', id: 's0', title: 'Added money', line: 'CA$250.00', time: '9:50 pm', dayLabel: 'Today', color: '#0B6E4F', icon: PLUS, status: 'Waiting', note: 'We are waiting for my Interac e-Transfer. This closes after 3 days.', when: 'Today, 9:50 pm', reference: 'PP653603E63B', steps: ['Requested'],
    rows: [['I add', 'CA$250.00'], ['Fee', 'No fee'], ['Message', 'PP653603E63B'], ['Reference', 'PP653603E63B']] },
  { key: 's1', type: 'EXCHANGE', id: 's1', title: 'Changed money', line: 'CA$100 to ₦90,000', time: '9:42 pm', dayLabel: 'Today', color: '#A84C08', icon: SWAP, status: 'Done', note: 'The money moved.', when: 'Today, 9:42 pm', reference: 'EX-sample-1', steps: ['Taken from your CAD wallet', 'Added to your NGN wallet'],
    rows: [['I gave', 'CA$100.00'], ['I got', '₦90,000'], ['Price', 'CA$1 = ₦900'], ['Reference', 'EX-sample-1']] },
  { key: 's2', type: 'P2P', id: 's2', title: 'Changed with a person', line: 'CA$100 to ₦96,040', time: '7:23 pm', dayLabel: 'Today', color: '#1D5BC7', icon: PEOPLE, status: 'Done', note: 'The money moved.', when: 'Today, 7:23 pm', reference: 'P2P-sample-1', steps: ['Base amount settled in CAD', 'Quote amount settled in NGN'],
    rows: [['I gave', 'CA$100.00'], ['Price', 'CA$1 = ₦980'], ['My P2P fee (CA$2 flat)', '−₦1,960'], ['I got', '₦96,040'], ['Reference', 'P2P-sample-1']] },
  { key: 's3', type: 'TRANSFER', id: 's3', title: 'Sent money', line: 'CA$45.00', time: '7:03 pm', dayLabel: 'Today', color: '#1D5BC7', icon: SEND, status: 'Done', note: 'The money moved.', when: 'Today, 7:03 pm', reference: 'TR-sample-1', steps: ['Debited from the source wallet', 'Credited to the destination wallet'],
    rows: [['I sent', 'CA$45.00'], ['To', 'A Palpeer user'], ['Reference', 'TR-sample-1']] },
  { key: 's4', type: 'WITHDRAWAL', id: 's4', title: 'Took out money', line: '₦5,000', time: '6:55 pm', dayLabel: 'Today', color: '#5E3AB8', icon: BANK, status: 'Done', note: 'The money moved.', when: 'Today, 6:55 pm', reference: 'WD-sample-1', steps: ['Held in your pending balance', 'Sent from your wallet'],
    rows: [['I took out', '₦5,000'], ['Bank', 'Kuda'], ['Account number', '0123456789'], ['Reference', 'WD-sample-1']] },
  { key: 's5', type: 'WITHDRAWAL', id: 's5', title: 'Took out money', line: '₦20,000', time: '5:40 pm', dayLabel: 'Today', color: '#5E3AB8', icon: BANK, status: 'Waiting', note: 'My bank has not finished this yet.', when: 'Today, 5:40 pm', reference: 'WD-sample-2', steps: ['Held in your pending balance'],
    rows: [['I took out', '₦20,000'], ['Bank', 'GTBank'], ['Account number', '0987654321'], ['Reference', 'WD-sample-2']] },
  { key: 's6', type: 'TRANSFER', id: 's6', title: 'Sent money', line: 'CA$20.00', time: '4:15 pm', dayLabel: 'Today', color: '#1D5BC7', icon: SEND, status: 'Not done', note: 'No money left my wallet.', when: 'Today, 4:15 pm', reference: 'TR-sample-2', steps: [],
    rows: [['I tried to send', 'CA$20.00'], ['To', 'A Palpeer user'], ['Reference', 'TR-sample-2']] },
  { key: 's7', type: 'WITHDRAWAL', id: 's7', title: 'Took out money', line: '₦10,000', time: '2:10 pm', dayLabel: 'Today', color: '#5E3AB8', icon: BANK, status: 'Money returned', note: 'The money came back to my wallet.', when: 'Today, 2:10 pm', reference: 'WD-sample-3', steps: ['Held in your pending balance', 'Returned to your available balance'],
    rows: [['I took out', '₦10,000'], ['Method', 'Interac e-Transfer'], ['Email', 'me@example.com'], ['Reference', 'WD-sample-3']] },
  { key: 's8', type: 'FUNDING', id: 's8', title: 'Added money', line: 'CA$100.00', time: '1:05 pm', dayLabel: 'Today', color: '#0B6E4F', icon: PLUS, status: 'Closed', note: 'I did not send the money within 3 days.', when: 'Today, 1:05 pm', reference: 'FD-sample-2', steps: ['Requested'],
    rows: [['I planned to add', 'CA$100.00'], ['Fee', 'No fee'], ['Reference', 'FD-sample-2']] },
  { key: 's9', type: 'FUNDING', id: 's9', title: 'Added money', line: 'CA$60.00', time: '12:30 pm', dayLabel: 'Today', color: '#0B6E4F', icon: PLUS, status: 'Held for review', note: 'It came late or from an email not on my account. Palpeer is checking it. This takes 24 to 48 hours.', when: 'Today, 12:30 pm', reference: 'FD-sample-3', steps: ['Requested'],
    rows: [['Money received', 'CA$60.00'], ['In my wallet', 'Not yet'], ['Reference', 'FD-sample-3']] }
];
const STATUS = { 'Held for review': '#A84C08', Closed: '#46574F', Done: '#0B6E4F', Waiting: '#A84C08', 'Not done': '#B3231A', 'Money returned': '#1D5BC7' };
const NOTE = 'The money moved.';
const SAMPLE_STATS = {
  periodTitle: 'All time',
  totalText: '10 transactions',
  countsText: '3 funding · 3 withdrawals · 1 exchange · 2 transfers · 1 p2p · 0 bonuses',
  moneyIn: 'CA$250.00',
  moneyOut: '₦5,000',
  footer: '1 completed exchange',
};
const SAMPLE_TYPE_OPTIONS = [
  { key: 'ALL', title: 'All types', note: 'Every kind of money move', selected: true },
  { key: 'FUNDING', title: 'Funding', note: 'Only funding', selected: false },
  { key: 'WITHDRAWAL', title: 'Withdrawals', note: 'Only withdrawals', selected: false },
  { key: 'EXCHANGE', title: 'Exchanges', note: 'Only exchanges', selected: false },
  { key: 'TRANSFER', title: 'Transfers', note: 'Only transfers', selected: false },
  { key: 'P2P', title: 'P2P', note: 'Only p2p', selected: false },
  { key: 'BONUS', title: 'Bonuses', note: 'Only bonuses', selected: false },
];
const SAMPLE_PERIOD_OPTIONS = [
  { key: 'ALL', title: 'All time', note: 'From the start', selected: true },
  { key: '7D', title: 'Last 7 days', note: 'This week', selected: false },
  { key: '30D', title: 'Last 30 days', note: 'This month', selected: false },
  { key: '90D', title: 'Last 90 days', note: 'Last 3 months', selected: false },
];

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: null, speaking: false, picker: null, typeKey: 'ALL', periodKey: 'ALL' };
    this.receiptRef = React.createRef();
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
      const voices = s.getVoices();
      const female = (v) => /female|woman|ezinne|samantha|zira|aria|jenny/i.test(v.name);
      const nigerian = (v) => /en[-_]NG/i.test(v.lang);
      const voice = voices.find((v) => nigerian(v) && female(v)) || voices.find(nigerian) ||
        voices.find((v) => /^en/i.test(v.lang) && female(v));
      u.lang = 'en-NG';
      if (voice) u.voice = voice;
      if (!voice || !female(voice)) u.pitch = 1.15;
      u.onend = () => this.setState({ speaking: false });
      this.setState({ speaking: true });
      s.speak(u);
    } catch (e) {
      this.setState({ speaking: false });
    }
  }
  sampleItems() {
    const { typeKey } = this.state;
    if (typeKey === 'ALL') return ITEMS;
    return ITEMS.filter((t) => t.type === typeKey);
  }
  renderVals() {
    const backend = !!this.props.backend;
    const sampleItems = this.sampleItems();
    const groups = backend
      ? (Array.isArray(this.props.groups) ? this.props.groups : [])
      : [{ key: 'today', label: 'Today', items: sampleItems }];
    const flat = backend
      ? (Array.isArray(this.props.liveItems) ? this.props.liveItems : [])
      : sampleItems;

    let chosen = null;
    if (backend) {
      chosen = this.props.detail || null;
    } else if (this.state.open != null) {
      chosen = sampleItems[this.state.open] || null;
    }

    const detail = chosen
      ? {
          ...chosen,
          status: chosen.status || 'Done',
          note: chosen.note || NOTE,
          color2: chosen.color2 || STATUS[chosen.status || 'Done'] || '#0B6E4F',
          rows: (chosen.rows || []).map((r) =>
            Array.isArray(r) ? { label: r[0], value: r[1] } : r
          ),
          steps: chosen.steps || [],
          when: chosen.when || ('Today, ' + (chosen.time || '')),
          reference: chosen.reference || chosen.id || '',
        }
      : { title: '', time: '', status: '', note: '', color2: '', rows: [], steps: [], when: '', reference: '' };

    const stats = backend ? (this.props.stats || SAMPLE_STATS) : {
      ...SAMPLE_STATS,
      periodTitle: (SAMPLE_PERIOD_OPTIONS.find((o) => o.key === this.state.periodKey) || SAMPLE_PERIOD_OPTIONS[0]).title,
      totalText: sampleItems.length === 1 ? '1 transaction' : sampleItems.length + ' transactions',
    };

    const typeOptions = backend
      ? (this.props.typeOptions || []).map((o) => ({
          ...o,
          pick: () => {
            if (o.pick) o.pick();
            this.setState({ picker: null });
          },
        }))
      : SAMPLE_TYPE_OPTIONS.map((o) => ({
          ...o,
          selected: o.key === this.state.typeKey,
          pick: () => this.setState({ typeKey: o.key, picker: null, open: null }),
        }));
    const periodOptions = backend
      ? (this.props.periodOptions || []).map((o) => ({
          ...o,
          pick: () => {
            if (o.pick) o.pick();
            this.setState({ picker: null });
          },
        }))
      : SAMPLE_PERIOD_OPTIONS.map((o) => ({
          ...o,
          selected: o.key === this.state.periodKey,
          pick: () => this.setState({ periodKey: o.key, picker: null }),
        }));

    const typeTitle = backend
      ? (this.props.typeTitle || 'All types')
      : (SAMPLE_TYPE_OPTIONS.find((o) => o.key === this.state.typeKey) || SAMPLE_TYPE_OPTIONS[0]).title;
    const periodTitle = backend
      ? (this.props.periodTitle || 'All time')
      : (SAMPLE_PERIOD_OPTIONS.find((o) => o.key === this.state.periodKey) || SAMPLE_PERIOD_OPTIONS[0]).title;

    const msgBadge = backend ? (this.props.msgBadge || '') : '3';
    const filtering = backend ? !!this.props.filtering : this.state.typeKey !== 'ALL' || this.state.periodKey !== 'ALL';
    const empty = backend ? !!this.props.empty : sampleItems.length === 0;
    const picker = this.state.picker;
    const saving = this.props.savingFormat;
    const canSave = backend ? !!this.props.canSave : false;

    const mappedGroups = groups.map((g) => ({
      key: g.key,
      label: g.label,
      items: (g.items || []).map((t, i) => ({
        ...t,
        status: t.status || 'Done',
        open: () => {
          if (backend && this.props.onOpenDetail) {
            this.props.onOpenDetail(t.type, t.id);
          } else {
            const idx = sampleItems.findIndex((x) => x.key === t.key);
            this.setState({ open: idx >= 0 ? idx : i });
          }
        },
      })),
    }));

    return {
      groups: mappedGroups,
      items: flat,
      stats,
      typeTitle,
      periodTitle,
      typeOptions,
      periodOptions,
      filtering,
      empty,
      historyLoading: !!this.props.historyLoading,
      hasMore: !!this.props.hasMore,
      loadingMore: !!this.props.loadingMore,
      more: () => (this.props.onLoadMore ? this.props.onLoadMore() : null),
      clearFilters: () => {
        if (backend && this.props.clearFilters) this.props.clearFilters();
        else this.setState({ typeKey: 'ALL', periodKey: 'ALL' });
      },
      openType: () => this.setState({ picker: 'type' }),
      openPeriod: () => this.setState({ picker: 'period' }),
      pickerOpen: !!picker,
      pickerTitle: picker === 'type' ? 'Type' : picker === 'period' ? 'Period' : '',
      pickerOptions: picker === 'type' ? typeOptions : picker === 'period' ? periodOptions : [],
      closePicker: () => this.setState({ picker: null }),
      detailOpen: backend ? !!this.props.detailOpen : this.state.open != null,
      detail,
      detailLoading: !!this.props.detailLoading,
      msgBadge,
      hasMsgBadge: !!msgBadge,
      close: () => {
        if (backend && this.props.onCloseDetail) this.props.onCloseDetail();
        else this.setState({ open: null });
      },
      canSave,
      savingImage: saving === 'image',
      savingPdf: saving === 'pdf',
      saveBusy: !!saving,
      saveImage: () => {
        if (!canSave || saving) return;
        if (backend && this.props.onSaveImage) this.props.onSaveImage(this.receiptRef);
      },
      savePdf: () => {
        if (!canSave || saving) return;
        if (backend && this.props.onSavePdf) this.props.onSavePdf(this.receiptRef);
      },
      listenLabel: this.state.speaking ? 'Stop' : 'Listen',
      listen: () => this.listen(chosen
        ? chosen.title + '. ' + (chosen.rows || []).map((r) => Array.isArray(r) ? (r[0] + ' ' + r[1]) : (r.label + ' ' + r.value)).join('. ') + '. ' + (chosen.status || 'Done') + '.'
        : 'History. ' + flat.map((t) => t.title + ', ' + t.line + ', at ' + t.time).join('. ') + '.')
    };
  }
}

export default class HistoryScreen extends Component {
  static defaultProps = {};
  static title = 'History';
  static background = '#F3F6F4';

  render() {
    const v = this.renderVals() || {};
    return (
      <DC.Box s={{ position: 'relative', backgroundColor: '#F3F6F4', color: '#0E1F19', fontFamily: "'Noto Sans', system-ui, sans-serif", _display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        <DC.Box s={{ flexShrink: 0, paddingTop: 8, paddingRight: 16, paddingBottom: 8, paddingLeft: 16, _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 12, minHeight: 52 }}>
          <DC.T s={{ fontSize: 30, fontWeight: '800', marginTop: 0, marginBottom: 0, marginRight: 0, marginLeft: 0, _lhMul: 1.15 }} role="header">{"History"}</DC.T>
          <DC.Box s={{ flexShrink: 0, height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label="Listen to this screen">
            <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M4 9.500v5h3.500L13 19V5L7.500 9.500H4z" fill="currentColor" /><SVG.Path d="M16.500 9a4.500 4.500 0 0 1 0 6" /><SVG.Path d="M19 6.500a8 8 0 0 1 0 11" /></DC.Icon>
            <DC.T>{v.listenLabel}</DC.T>
          </DC.Box>
        </DC.Box>
        <DC.Box s={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, paddingTop: 0, paddingRight: 16, paddingBottom: 10, paddingLeft: 16, _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
          <DC.Box s={{ flexShrink: 0, _display: 'grid', _cols: 2, rowGap: 8, columnGap: 8 }}>
            <DC.Box s={{ minHeight: 64, paddingTop: 10, paddingRight: 12, paddingBottom: 10, paddingLeft: 12, borderRadius: 16, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="button" onPress={v.openType} label="Filter by type">
              <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{"Type"}</DC.T>
              <DC.T s={{ fontSize: 17, fontWeight: '800' }}>{v.typeTitle}</DC.T>
            </DC.Box>
            <DC.Box s={{ minHeight: 64, paddingTop: 10, paddingRight: 12, paddingBottom: 10, paddingLeft: 12, borderRadius: 16, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="button" onPress={v.openPeriod} label="Filter by period">
              <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{"Period"}</DC.T>
              <DC.T s={{ fontSize: 17, fontWeight: '800' }}>{v.periodTitle}</DC.T>
            </DC.Box>
          </DC.Box>

          <DC.Box s={{ flexShrink: 0, paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14, borderRadius: 20, backgroundColor: '#FFFFFF', _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }} label="History stats">
            <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{v.stats?.periodTitle}</DC.T>
            <DC.T s={{ fontSize: 26, fontWeight: '800', _lhMul: 1.15 }}>{v.stats?.totalText}</DC.T>
            {v.stats?.countsText ? <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#46574F', _lhMul: 1.35 }}>{v.stats.countsText}</DC.T> : null}
            <DC.Box s={{ _display: 'grid', _cols: 2, rowGap: 10, columnGap: 10 }}>
              <DC.Box s={{ paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, borderRadius: 14, backgroundColor: '#E8F5EF', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#0B6E4F' }}>{"Money in"}</DC.T>
                <DC.T s={{ fontSize: 16, fontWeight: '800' }}>{v.stats?.moneyIn}</DC.T>
              </DC.Box>
              <DC.Box s={{ paddingTop: 10, paddingRight: 10, paddingBottom: 10, paddingLeft: 10, borderRadius: 14, backgroundColor: '#F3EEFB', _display: 'flex', flexDirection: 'column', rowGap: 4, columnGap: 4 }}>
                <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#5E3AB8' }}>{"Money out"}</DC.T>
                <DC.T s={{ fontSize: 16, fontWeight: '800' }}>{v.stats?.moneyOut}</DC.T>
              </DC.Box>
            </DC.Box>
            {v.stats?.footer ? <DC.T s={{ fontSize: 14, fontWeight: '600', color: '#46574F' }}>{v.stats.footer}</DC.T> : null}
          </DC.Box>

          {v.filtering ? (
            <DC.Box s={{ flexShrink: 0, minHeight: 44, borderRadius: 14, backgroundColor: '#E9EEEB', color: '#0E1F19', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.clearFilters}>
              <DC.T>{"Clear filters"}</DC.T>
            </DC.Box>
          ) : null}

          <DC.Box s={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, _scroll: 'y', _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
            {v.historyLoading && v.empty ? (
              <DC.T s={{ fontSize: 17, fontWeight: '600', color: '#46574F', textAlign: 'center', paddingTop: 24 }}>{"Loading history…"}</DC.T>
            ) : null}
            {v.empty && !v.historyLoading ? (
              <DC.Box s={{ paddingTop: 28, paddingBottom: 28, _display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 10, columnGap: 10 }}>
                <DC.T s={{ fontSize: 22, fontWeight: '800' }}>{v.filtering ? 'No matches' : 'No activity yet'}</DC.T>
                <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F', textAlign: 'center' }}>
                  {v.filtering ? 'Nothing matches these filters.' : 'Funding, withdrawals and exchanges will show here.'}
                </DC.T>
              </DC.Box>
            ) : null}
            {DC.list(v.groups).map((g, $gi) => (
              <DC.Box key={g.key || $gi} s={{ flexShrink: 0, _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
                <DC.T s={{ fontSize: 19, fontWeight: '800', _lhMul: 1.2 }} role="header">{g.label}</DC.T>
                {DC.list(g.items).map((t, $index) => (
                  <DC.Box key={t.key || $index} s={{ flexShrink: 0, minHeight: 104, paddingTop: 12, paddingRight: 14, paddingBottom: 12, paddingLeft: 14, borderWidth: 0, borderRadius: 20, backgroundColor: '#FFFFFF', color: '#0E1F19', textAlign: 'left', _display: 'flex', alignItems: 'center', rowGap: 12, columnGap: 12 }} kind="button" onPress={t.open}>
                    <DC.Box s={DC.css(`flex-shrink: 0; width: 52px; height: 52px; border-radius: 26px; background: ${DC.S(t?.color)}; color: #FFFFFF; display: flex; align-items: center; justify-content: center`)}>
                      <DC.Icon w={30} h={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.500" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d={t?.icon} /></DC.Icon>
                    </DC.Box>
                    <DC.Box s={{ minWidth: 0, flexGrow: 1, _display: 'flex', flexDirection: 'column', rowGap: 1, columnGap: 1 }}>
                      <DC.T s={{ fontSize: 17, _lhMul: 1.25, fontWeight: '700' }}>{t?.title}</DC.T>
                      <DC.T s={{ fontSize: 21, _lhMul: 1.2, fontWeight: '800' }}>{t?.line}</DC.T>
                      <DC.T s={{ fontSize: 15, _lhMul: 1.3, fontWeight: '600', color: '#46574F' }}>{t?.time}{'. '}{t?.status}</DC.T>
                    </DC.Box>
                  </DC.Box>
                ))}
              </DC.Box>
            ))}
            {v.hasMore ? (
              <DC.Box s={{ flexShrink: 0, minHeight: 52, borderRadius: 16, backgroundColor: '#E9EEEB', color: '#0E1F19', fontSize: 17, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.more} disabled={v.loadingMore}>
                <DC.T>{v.loadingMore ? 'Loading…' : 'Load more'}</DC.T>
              </DC.Box>
            ) : null}
          </DC.Box>
        </DC.Box>

        <DC.StickyBottom s={{ flexShrink: 0, backgroundColor: '#FFFFFF', _display: 'grid', _cols: 4, paddingTop: 6, paddingRight: 8, paddingBottom: 10, paddingLeft: 8 }} label="Main menu">
          <DC.Box s={{ minHeight: 62, color: '#33453D', textDecorationLine: 'none', fontSize: 15, fontWeight: '600', _display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="link" href="Main.dc.html">
            <DC.Icon w={28} h={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinejoin="round"><SVG.Path d="M3 11.500 12 4l9 7.500V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></DC.Icon>
            <DC.T>{"Home"}</DC.T>
          </DC.Box>
          <DC.Box s={{ minHeight: 62, borderWidth: 0, backgroundColor: 'transparent', color: '#0B6E4F', fontSize: 15, fontWeight: '800', _display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="button" selected={true}>
            <DC.Icon w={28} h={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><SVG.Path d="M9.500 8h5M9.500 12.500h5" /></DC.Icon>
            <DC.T>{"History"}</DC.T>
          </DC.Box>
          <DC.Box s={{ minHeight: 62, color: '#33453D', textDecorationLine: 'none', fontSize: 15, fontWeight: '600', _display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="link" href="Messages.dc.html" label={v.hasMsgBadge ? `Messages, ${v.msgBadge} unread notifications` : 'Messages'}>
            <DC.Box s={{ position: 'relative', _display: 'flex' }}>
              <DC.Icon w={28} h={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><SVG.Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></DC.Icon>
              {v.hasMsgBadge ? (
                <DC.T s={{ position: 'absolute', top: -5, left: 18, minWidth: 20, height: 20, paddingTop: 0, paddingRight: 3, paddingBottom: 0, paddingLeft: 3, borderRadius: 10, backgroundColor: '#C2261C', color: '#FFFFFF', fontSize: 12, lineHeight: 20, fontWeight: '800', textAlign: 'center' }}>{v.msgBadge}</DC.T>
              ) : null}
            </DC.Box>
            <DC.T>{"Messages"}</DC.T>
          </DC.Box>
          <DC.Box s={{ minHeight: 62, color: '#33453D', textDecorationLine: 'none', fontSize: 15, fontWeight: '600', _display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', rowGap: 2, columnGap: 2 }} kind="link" href="More.dc.html">
            <DC.Icon w={28} h={28} viewBox="0 0 24 24" fill="currentColor"><SVG.Circle cx="5" cy="12" r="2.200" /><SVG.Circle cx="12" cy="12" r="2.200" /><SVG.Circle cx="19" cy="12" r="2.200" /></DC.Icon>
            <DC.T>{"More"}</DC.T>
          </DC.Box>
        </DC.StickyBottom>

        {v.pickerOpen ? (
          <DC.Box s={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, backgroundColor: '#F3F6F4', _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14 }}>
            <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 12, minHeight: 52 }}>
              <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 10, borderWidth: 0, borderRadius: 26, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 6, columnGap: 6 }} kind="button" onPress={v.closePicker}>
                <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M20 12H5M11 6l-6 6 6 6" /></DC.Icon>
                <DC.T>{"Back"}</DC.T>
              </DC.Box>
            </DC.Box>
            <DC.T s={{ fontSize: 30, fontWeight: '800', _lhMul: 1.15 }} role="header">{v.pickerTitle}</DC.T>
            <DC.Box s={{ flexGrow: 1, minHeight: 0, _scroll: 'y', _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10 }}>
              {DC.list(v.pickerOptions).map((o, $i) => (
                <DC.Box key={o.key || $i} s={DC.css(`flex-shrink: 0; min-height: 76px; box-sizing: border-box; padding: 10px 16px; border: 3px solid ${o.selected ? '#0B6E4F' : '#FFFFFF'}; border-radius: 18px; background: #FFFFFF; color: #0E1F19; text-align: left; display: flex; flex-direction: column; justify-content: center; gap: 2px`)} kind="button" onPress={o.pick} selected={!!o.selected}>
                  <DC.T s={{ fontSize: 20, _lhMul: 1.2, fontWeight: '800' }}>{o.title}</DC.T>
                  <DC.T s={{ fontSize: 16, _lhMul: 1.3, fontWeight: '600', color: '#46574F' }}>{o.note}</DC.T>
                </DC.Box>
              ))}
            </DC.Box>
          </DC.Box>
        ) : null}

        {v.detailOpen ? (
          <DC.Box s={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: 18, paddingRight: 16, paddingBottom: 20, paddingLeft: 16, backgroundColor: '#F3F6F4', _display: 'flex', flexDirection: 'column', rowGap: 14, columnGap: 14 }}>
            <DC.Box s={{ _display: 'flex', alignItems: 'center', justifyContent: 'space-between', rowGap: 12, columnGap: 12, minHeight: 52 }}>
              <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 10, borderWidth: 0, borderRadius: 26, backgroundColor: '#FFFFFF', color: '#0E1F19', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 6, columnGap: 6 }} kind="button" onPress={v.close}>
                <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M20 12H5M11 6l-6 6 6 6" /></DC.Icon>
                <DC.T>{"Back"}</DC.T>
              </DC.Box>
              <DC.Box s={{ height: 52, paddingTop: 0, paddingRight: 16, paddingBottom: 0, paddingLeft: 12, borderWidth: 0, borderRadius: 26, backgroundColor: '#0E1F19', color: '#FFFFFF', fontSize: 17, fontWeight: '700', _display: 'flex', alignItems: 'center', rowGap: 8, columnGap: 8 }} kind="button" onPress={v.listen} label="Listen to this screen">
                <DC.Icon w={26} h={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round"><SVG.Path d="M4 9.500v5h3.500L13 19V5L7.500 9.500H4z" fill="currentColor" /><SVG.Path d="M16.500 9a4.500 4.500 0 0 1 0 6" /><SVG.Path d="M19 6.500a8 8 0 0 1 0 11" /></DC.Icon>
                <DC.T>{v.listenLabel}</DC.T>
              </DC.Box>
            </DC.Box>
            <DC.T s={{ fontSize: 30, fontWeight: '800', _lhMul: 1.15 }} role="header">{v.detail?.title}</DC.T>
            <DC.Box s={{ flexGrow: 1, minHeight: 0, _scroll: 'y', _display: 'flex', flexDirection: 'column', rowGap: 12, columnGap: 12 }}>
              <View ref={this.receiptRef} collapsable={false} style={{ backgroundColor: '#F3F6F4', gap: 12 }}>
                <DC.Box s={{ backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 14, paddingRight: 18, paddingBottom: 14, paddingLeft: 18, _display: 'flex', flexDirection: 'column', rowGap: 10, columnGap: 10, fontSize: 18, _lhMul: 1.3 }} label="Receipt">
                  {DC.list(v.detail?.rows).map((r, $index) => (
                    <DC.Box key={$index} s={{ _display: 'flex', justifyContent: 'space-between', rowGap: 12, columnGap: 12 }}>
                      <DC.T s={{ fontWeight: '600', color: '#33453D', flexShrink: 1 }}>{r?.label}</DC.T>
                      <DC.T s={{ fontWeight: '800', textAlign: 'right', flexShrink: 1 }}>{r?.value}</DC.T>
                    </DC.Box>
                  ))}
                  <DC.Box s={{ height: 1, backgroundColor: '#DDE4E0' }} />
                  <DC.T s={DC.css(`font-weight: 800; color: ${DC.S(v.detail?.color2)}`)}>{v.detail?.status}</DC.T>
                  <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#33453D' }}>{v.detail?.note}</DC.T>
                  <DC.T s={{ fontSize: 16, fontWeight: '600', color: '#46574F' }}>{v.detail?.when}</DC.T>
                </DC.Box>
                {v.detail?.steps && v.detail.steps.length ? (
                  <DC.Box s={{ backgroundColor: '#FFFFFF', borderRadius: 22, paddingTop: 14, paddingRight: 18, paddingBottom: 14, paddingLeft: 18, _display: 'flex', flexDirection: 'column', rowGap: 8, columnGap: 8 }} label="Progress">
                    <DC.T s={{ fontSize: 13, fontWeight: '700', color: '#5B6B64', textTransform: 'uppercase' }}>{"Progress"}</DC.T>
                    <DC.T s={{ fontSize: 16, fontWeight: '700' }}>{"Requested"}</DC.T>
                    {DC.list(v.detail.steps).map((step, $si) => (
                      <DC.T key={$si} s={{ fontSize: 16, fontWeight: '600', color: '#33453D' }}>{step}</DC.T>
                    ))}
                  </DC.Box>
                ) : null}
              </View>
              {v.canSave ? (
                <DC.Box s={{ flexShrink: 0, _display: 'grid', _cols: 2, rowGap: 8, columnGap: 8 }}>
                  <DC.Box s={{ minHeight: 56, borderRadius: 16, backgroundColor: '#0B6E4F', color: '#FFFFFF', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.saveImage} disabled={v.saveBusy} label="Save as image">
                    <DC.T>{v.savingImage ? 'Saving…' : 'Save as image'}</DC.T>
                  </DC.Box>
                  <DC.Box s={{ minHeight: 56, borderRadius: 16, borderWidth: 3, borderColor: '#0B6E4F', borderStyle: 'solid', backgroundColor: '#FFFFFF', color: '#0B6E4F', fontSize: 16, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="button" onPress={v.savePdf} disabled={v.saveBusy} label="Save as PDF">
                    <DC.T>{v.savingPdf ? 'Saving…' : 'Save as PDF'}</DC.T>
                  </DC.Box>
                </DC.Box>
              ) : null}
              <DC.Box s={{ flexShrink: 0, minHeight: 60, borderWidth: 3, borderColor: '#0B6E4F', borderStyle: 'solid', borderRadius: 20, color: '#0B6E4F', textDecorationLine: 'none', fontSize: 20, fontWeight: '800', _display: 'flex', alignItems: 'center', justifyContent: 'center' }} kind="link" href="MoreHelp.dc.html">
                <DC.T>{"Get help with this"}</DC.T>
              </DC.Box>
            </DC.Box>
          </DC.Box>
        ) : null}
      </DC.Box>
    );
  }
}
