import {
  canShareSellOrder,
  sellOrderAcceptPath,
  sellOrderShareMessage,
  sellOrderSharePath,
  sellOrderShareUrl,
} from '../shareSellOrder';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
/** Jest setup points EXPO_PUBLIC_API_BASE_URL at http://api.test/api/v1. */
const SHARE_URL = `http://api.test/p2p/share/${ID}`;

describe('shareSellOrder helpers', () => {
  it('builds share and accept paths', () => {
    expect(sellOrderSharePath(ID)).toBe(`/p2p/share/${ID}`);
    expect(sellOrderAcceptPath(ID)).toBe(`/p2p/request/${ID}`);
    expect(sellOrderShareUrl(ID)).toBe(SHARE_URL);
  });

  it('includes amount, rate and API app-open bridge link in the share message', () => {
    const message = sellOrderShareMessage(
      {
        id: ID,
        amount: '100.00',
        rate: '980',
        baseCurrencyCode: 'CAD',
        quoteCurrencyCode: 'NGN',
      },
      '100.00 CAD',
    );
    expect(message).toContain('100.00 CAD');
    expect(message).toContain(SHARE_URL);
    expect(message).toContain('PALPEER');
    expect(message).not.toContain('https://app.palpeer.com');
  });

  it('only allows sharing own open sell requests', () => {
    expect(canShareSellOrder({ side: 'SELL', status: 'OPEN' }, true, 'OPEN')).toBe(true);
    expect(canShareSellOrder({ side: 'BUY', status: 'OPEN' }, true, 'OPEN')).toBe(false);
    expect(canShareSellOrder({ side: 'SELL', status: 'OPEN' }, false, 'OPEN')).toBe(false);
    expect(canShareSellOrder({ side: 'SELL', status: 'OPEN' }, true, 'CANCELLED')).toBe(false);
  });
});
