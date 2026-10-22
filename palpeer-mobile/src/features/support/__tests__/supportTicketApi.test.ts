import { supportTicketTrackingUrl, type CreatePublicTicketResponse } from '@/services/supportChat/supportChatApi';

describe('supportTicketTrackingUrl', () => {
  it('prefers an absolute trackingUrl', () => {
    const ticket: CreatePublicTicketResponse = {
      trackingUrl: 'https://app.palpeer.com.ng/track-ticket?token=abc&ticket=T-1',
    };
    expect(supportTicketTrackingUrl(ticket)).toBe(
      'https://app.palpeer.com.ng/track-ticket?token=abc&ticket=T-1',
    );
  });

  it('builds a URL from relative path or token + ticket number', () => {
    expect(
      supportTicketTrackingUrl({ trackingUrl: '/track-ticket?token=abc&ticket=T-2' }),
    ).toBe('https://app.palpeer.com.ng/track-ticket?token=abc&ticket=T-2');
    expect(
      supportTicketTrackingUrl({ accessToken: 'tok', ticketNumber: 'T-3' }),
    ).toBe('https://app.palpeer.com.ng/track-ticket?token=tok&ticket=T-3');
  });
});
