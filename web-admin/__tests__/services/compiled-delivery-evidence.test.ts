import {
  assertCompiledDeliveryEvidence,
  assertCompiledPickupEvidence,
  compiledDeliveryPodMethodCodes,
  CompiledDeliveryEvidenceError,
  hasCompiledDeliveryEvidence,
} from '@/lib/services/delivery/compiled-delivery-evidence';

const SIGNATURE_ONLY = [{
  fulfilment_channel: 'delivery' as const,
  evidence_method_code: 'signature',
  is_required: true,
  minimum_count: 1,
}];

describe('compiled delivery evidence', () => {
  it('does not constrain legacy orders without compiled delivery methods', () => {
    expect(hasCompiledDeliveryEvidence([])).toBe(false);
    expect(() => assertCompiledDeliveryEvidence({
      evidence: [],
      podMethodCode: 'PHOTO',
      hasSignature: false,
      photoCount: 0,
    })).not.toThrow();
  });

  it('ignores OTP-only artifacts so the live catalog remains the method source', () => {
    expect(hasCompiledDeliveryEvidence([{
      fulfilment_channel: 'delivery',
      evidence_method_code: 'otp',
      is_required: false,
      minimum_count: 0,
    }])).toBe(false);
  });

  it('rejects a method that is not compiled into the artifact', () => {
    expect(() => assertCompiledDeliveryEvidence({
      evidence: SIGNATURE_ONLY,
      podMethodCode: 'PHOTO',
      hasSignature: false,
      photoCount: 1,
    })).toThrow(CompiledDeliveryEvidenceError);
  });

  it('requires the compiled signature even when a photo is also supplied', () => {
    try {
      assertCompiledDeliveryEvidence({
        evidence: SIGNATURE_ONLY,
        podMethodCode: 'SIGNATURE',
        hasSignature: false,
        photoCount: 1,
      });
      throw new Error('expected compiled evidence to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'POD_EVIDENCE_REQUIRED' });
    }
  });

  it('enforces the compiled photo minimum', () => {
    try {
      assertCompiledDeliveryEvidence({
        evidence: [{
          fulfilment_channel: 'delivery',
          evidence_method_code: 'photo',
          is_required: true,
          minimum_count: 2,
        }],
        podMethodCode: 'PHOTO',
        hasSignature: false,
        photoCount: 1,
      });
      throw new Error('expected compiled evidence to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'POD_EVIDENCE_REQUIRED' });
    }
  });

  it('accepts a permitted signature with the required proof present', () => {
    expect(() => assertCompiledDeliveryEvidence({
      evidence: SIGNATURE_ONLY,
      podMethodCode: 'SIGNATURE',
      hasSignature: true,
      photoCount: 0,
    })).not.toThrow();
  });

  it('accepts POD confirmation without photo or signature uploads', () => {
    expect(() => assertCompiledDeliveryEvidence({
      evidence: [{
        fulfilment_channel: 'delivery',
        evidence_method_code: 'pod',
        is_required: false,
        minimum_count: 0,
      }],
      podMethodCode: 'POD',
      hasSignature: false,
      photoCount: 0,
      hasNotes: false,
    })).not.toThrow();
  });

  it('derives MIXED when both signature and photo are compiled', () => {
    expect(() => assertCompiledDeliveryEvidence({
      evidence: [
        {
          fulfilment_channel: 'delivery',
          evidence_method_code: 'signature',
          is_required: false,
          minimum_count: 0,
        },
        {
          fulfilment_channel: 'delivery',
          evidence_method_code: 'photo',
          is_required: false,
          minimum_count: 1,
        },
      ],
      podMethodCode: 'MIXED',
      hasSignature: true,
      photoCount: 1,
    })).not.toThrow();
  });

  it('requires delivery notes when the compiled notes option is required', () => {
    try {
      assertCompiledDeliveryEvidence({
        evidence: [{
          fulfilment_channel: 'delivery',
          evidence_method_code: 'notes',
          is_required: true,
          minimum_count: 0,
        }],
        podMethodCode: 'POD',
        hasSignature: false,
        photoCount: 0,
        hasNotes: false,
      });
      throw new Error('expected compiled notes to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'POD_EVIDENCE_REQUIRED' });
    }
  });

  it('requires pickup notes when the compiled pickup notes option is required', () => {
    try {
      assertCompiledPickupEvidence({
        evidence: [{
          fulfilment_channel: 'pickup',
          evidence_method_code: 'notes',
          is_required: true,
          minimum_count: 0,
        }],
        hasNotes: false,
      });
      throw new Error('expected compiled pickup notes to fail');
    } catch (error) {
      expect(error).toMatchObject({ code: 'POD_EVIDENCE_REQUIRED' });
    }
  });

  it('projects compiled POD method codes and derives MIXED plus POD-from-notes', () => {
    expect(compiledDeliveryPodMethodCodes([
      {
        fulfilment_channel: 'delivery',
        evidence_method_code: 'signature',
        is_required: false,
        minimum_count: 0,
      },
      {
        fulfilment_channel: 'delivery',
        evidence_method_code: 'photo',
        is_required: false,
        minimum_count: 1,
      },
      {
        fulfilment_channel: 'delivery',
        evidence_method_code: 'notes',
        is_required: false,
        minimum_count: 0,
      },
    ])).toEqual(['MIXED', 'NOTES', 'PHOTO', 'POD', 'SIGNATURE']);
  });
});
