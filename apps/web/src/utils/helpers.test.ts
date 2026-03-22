import { describe, it, expect } from 'vitest';
import { parseDonationMessage, parseAmount, isDonateBot } from './helpers';

describe('parseDonationMessage', () => {
  describe('LivePix format', () => {
    it('parses "doou R$ X:" format', () => {
      const result = parseDonationMessage('João doou R$ 10,00: Nurse');
      expect(result).toEqual({ donor: 'João', amount: 'R$ 10,00', message: 'Nurse' });
    });

    it('parses "doou R$ X e disse:" format', () => {
      const result = parseDonationMessage('João doou R$ 50,00 e disse: quero Huntress');
      expect(result).toEqual({ donor: 'João', amount: 'R$ 50,00', message: 'quero Huntress' });
    });

    it('parses "mandou R$ X:" format', () => {
      const result = parseDonationMessage('Maria mandou R$ 25,50: Trapper');
      expect(result).toEqual({ donor: 'Maria', amount: 'R$ 25,50', message: 'Trapper' });
    });

    it('parses R$ without space', () => {
      const result = parseDonationMessage('User doou R$10,00: Nurse');
      expect(result).toEqual({ donor: 'User', amount: 'R$10,00', message: 'Nurse' });
    });
  });

  describe('StreamElements format', () => {
    it('parses "mandou X e disse:" without currency', () => {
      const result = parseDonationMessage('User123 mandou 5.00 e disse: Vai de Trapper pra gente ver também');
      expect(result).toEqual({
        donor: 'User123',
        amount: '5.00',
        message: 'Vai de Trapper pra gente ver também'
      });
    });

    it('parses "just tipped $X -" format', () => {
      const result = parseDonationMessage('TestUser just tipped $10.00 - Nurse please');
      expect(result).toEqual({ donor: 'TestUser', amount: '$10.00', message: 'Nurse please' });
    });

    it('parses "just tipped $X:" format', () => {
      const result = parseDonationMessage('TestUser just tipped $5.00: Huntress');
      expect(result).toEqual({ donor: 'TestUser', amount: '$5.00', message: 'Huntress' });
    });
  });

  describe('currency variations', () => {
    it('handles no currency prefix', () => {
      const result = parseDonationMessage('User mandou 5.00 e disse: Nurse');
      expect(result).toEqual({ donor: 'User', amount: '5.00', message: 'Nurse' });
    });

    it('handles $ prefix', () => {
      const result = parseDonationMessage('User just tipped $5.00: Nurse');
      expect(result).toEqual({ donor: 'User', amount: '$5.00', message: 'Nurse' });
    });

    it('handles R$ with space', () => {
      const result = parseDonationMessage('User doou R$ 10,00: Nurse');
      expect(result).toEqual({ donor: 'User', amount: 'R$ 10,00', message: 'Nurse' });
    });

    it('handles R$ without space', () => {
      const result = parseDonationMessage('User doou R$10,00: Nurse');
      expect(result).toEqual({ donor: 'User', amount: 'R$10,00', message: 'Nurse' });
    });
  });

  describe('separator variations', () => {
    it('handles colon separator', () => {
      const result = parseDonationMessage('User doou R$ 10,00: Nurse');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Nurse');
    });

    it('handles "e disse:" separator', () => {
      const result = parseDonationMessage('User mandou 5.00 e disse: Nurse');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Nurse');
    });

    it('handles dash separator', () => {
      const result = parseDonationMessage('User mandou 5.00 - Nurse');
      expect(result).not.toBeNull();
      expect(result!.message).toBe('Nurse');
    });
  });

  describe('non-matches', () => {
    it('rejects regular chat', () => {
      expect(parseDonationMessage('oi galera')).toBeNull();
    });

    it('rejects chat commands', () => {
      expect(parseDonationMessage('!fila Huntress')).toBeNull();
    });

    it('rejects empty message after amount', () => {
      expect(parseDonationMessage('User doou R$ 10,00:')).toBeNull();
    });

    it('rejects message without verb', () => {
      expect(parseDonationMessage('User R$ 10,00: Nurse')).toBeNull();
    });

    it('rejects message without amount', () => {
      expect(parseDonationMessage('User doou: Nurse')).toBeNull();
    });

    it('rejects message without separator', () => {
      expect(parseDonationMessage('User doou R$ 10,00 Nurse')).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    it('matches "DOOU" uppercase', () => {
      const result = parseDonationMessage('User DOOU R$ 10,00: Nurse');
      expect(result).not.toBeNull();
    });

    it('matches "Just Tipped" mixed case', () => {
      const result = parseDonationMessage('User Just Tipped $5.00: Nurse');
      expect(result).not.toBeNull();
    });
  });
});

describe('isDonateBot', () => {
  it('recognizes livepix', () => {
    expect(isDonateBot('livepix')).toBe(true);
  });

  it('recognizes LivePix (case insensitive)', () => {
    expect(isDonateBot('LivePix')).toBe(true);
  });

  it('recognizes streamelements', () => {
    expect(isDonateBot('streamelements')).toBe(true);
  });

  it('recognizes StreamElements (case insensitive)', () => {
    expect(isDonateBot('StreamElements')).toBe(true);
  });

  it('rejects random usernames', () => {
    expect(isDonateBot('randomuser')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isDonateBot('')).toBe(false);
  });
});

describe('parseAmount', () => {
  it('parses Brazilian format (comma decimal)', () => {
    expect(parseAmount('10,00')).toBe(10);
  });

  it('parses dot decimal format', () => {
    expect(parseAmount('5.00')).toBe(5);
  });

  it('treats comma as decimal (Brazilian format)', () => {
    expect(parseAmount('1,50')).toBe(1.5);
  });

  it('parses integer amount', () => {
    expect(parseAmount('50')).toBe(50);
  });

  it('returns 0 for non-numeric', () => {
    expect(parseAmount('abc')).toBe(0);
  });
});
