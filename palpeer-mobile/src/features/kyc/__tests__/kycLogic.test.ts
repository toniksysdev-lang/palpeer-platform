import { media } from '@/tests/mocks/media';

import { kycErrorMessage } from '../errors';
import { checkImageQuality, ImageQualityError, prepareImage } from '../image';
import { canUpload, isKycDocumentType, kycPhase, nextKycStep } from '../kycState';
import { isValidPastIsoDate, kycSubmitSchema, toStartVerificationRequest } from '../schemas';
import { createAppError } from '@/services/api/errors';

describe('kycState', () => {
  it('only allows uploads while the case is open', () => {
    expect(canUpload('NOT_STARTED')).toBe(true);
    expect(canUpload('IN_PROGRESS')).toBe(true);
    expect(canUpload('REJECTED')).toBe(true);
    expect(canUpload('SUBMITTED')).toBe(false);
    expect(canUpload('UNDER_REVIEW')).toBe(false);
    expect(canUpload('APPROVED')).toBe(false);
  });

  it('maps statuses to phases', () => {
    expect(kycPhase('NOT_STARTED')).toBe('collecting');
    expect(kycPhase('SUBMITTED')).toBe('reviewing');
    expect(kycPhase('UNDER_REVIEW')).toBe('reviewing');
    expect(kycPhase('APPROVED')).toBe('approved');
    expect(kycPhase('REJECTED')).toBe('rejected');
  });

  it('picks the next step: document, then selfie, then submit', () => {
    const base = { status: 'IN_PROGRESS' as const, hasDocument: false, hasSelfie: false };
    expect(nextKycStep(base)).toBe('document');
    expect(nextKycStep({ ...base, hasDocument: true })).toBe('selfie');
    expect(nextKycStep({ ...base, hasDocument: true, hasSelfie: true })).toBe('submit');
    expect(nextKycStep({ ...base, status: 'UNDER_REVIEW', hasDocument: true })).toBeNull();
  });

  it('accepts only the listed document types', () => {
    expect(isKycDocumentType('PASSPORT')).toBe(true);
    expect(isKycDocumentType('passport')).toBe(false);
    expect(isKycDocumentType(undefined)).toBe(false);
  });

  it('prefers friendly copy for known codes', () => {
    expect(kycErrorMessage(createAppError('server', { code: 'STORAGE_WRITE_FAILED' }))).toBe(
      "We couldn't save your photo. Please try again.",
    );
    expect(kycErrorMessage(createAppError('conflict', { message: 'Other' }))).toBe('Other');
  });
});

describe('image preparation', () => {
  beforeEach(() => media.reset());

  it('rejects photos below the minimum resolution', () => {
    expect(() => checkImageQuality({ width: 640, height: 480 }, 'document')).toThrow(
      ImageQualityError,
    );
    expect(() => checkImageQuality({ width: 640, height: 480 }, 'selfie')).not.toThrow();
  });

  it('downsizes large photos and re-encodes them as JPEG', async () => {
    media.sizes['file:///big.png'] = { width: 4000, height: 3000 };

    const prepared = await prepareImage(
      { uri: 'file:///big.png', width: 4000, height: 3000 },
      'document',
    );

    expect(media.resize).toHaveBeenCalledWith({ width: 2000 });
    expect(prepared).toMatchObject({
      uri: 'file:///prepared.jpeg',
      width: 2000,
      height: 1500,
      mimeType: 'image/jpeg',
    });
    expect(prepared.name).toMatch(/^document-\d+\.jpg$/);
  });

  it('keeps small-enough photos at their size', async () => {
    media.sizes['file:///ok.jpg'] = { width: 1080, height: 1440 };
    await prepareImage({ uri: 'file:///ok.jpg', width: 1080, height: 1440 }, 'selfie');
    expect(media.resize).not.toHaveBeenCalled();
  });
});

describe('submit form', () => {
  const today = new Date(2026, 8, 28);

  it('validates dates of birth', () => {
    expect(isValidPastIsoDate('1990-04-21', today)).toBe(true);
    expect(isValidPastIsoDate('1990-02-30', today)).toBe(false);
    expect(isValidPastIsoDate('21/04/1990', today)).toBe(false);
    expect(isValidPastIsoDate('2030-01-01', today)).toBe(false);
  });

  it('requires names and checks the optional fields', () => {
    const result = kycSubmitSchema.safeParse({
      firstName: ' ',
      lastName: 'Lovelace',
      dateOfBirth: 'soon',
      issuingCountry: 'NGA',
    });
    expect(result.success).toBe(false);
    const fields = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(['firstName', 'dateOfBirth', 'issuingCountry']);
  });

  it('builds the request with trimmed values and omits blank optionals', () => {
    expect(
      toStartVerificationRequest({
        firstName: ' Ada ',
        lastName: 'Lovelace',
        dateOfBirth: '',
        issuingCountry: 'ng',
      }),
    ).toEqual({ firstName: 'Ada', lastName: 'Lovelace', issuingCountry: 'NG' });
  });
});
