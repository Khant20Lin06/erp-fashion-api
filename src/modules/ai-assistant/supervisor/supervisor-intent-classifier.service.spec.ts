import { SupervisorIntentClassifierService } from './supervisor-intent-classifier.service';

describe('SupervisorIntentClassifierService', () => {
  let classifier: SupervisorIntentClassifierService;

  beforeEach(() => {
    classifier = new SupervisorIntentClassifierService();
  });

  describe('Inventory Domain Queries', () => {
    it('classifies Burmese warehouse stock query as inventory', () => {
      const result = classifier.classify('ဂိုဒေါင်ထဲမှာ လက်ကျန်စတော့ ဘယ်လောက်ရှိလဲ');
      expect(result.targetAgent).toBe('inventory');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies English slow-moving stock query as inventory', () => {
      const result = classifier.classify('Show me the slow-moving stock in warehouse');
      expect(result.targetAgent).toBe('inventory');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Sales & POS Domain Queries', () => {
    it('classifies Burmese store sales query as sales_pos', () => {
      const result = classifier.classify('ဒီနေ့ ကောင်တာ အရောင်း ဘယ်လောက်ရလဲ');
      expect(result.targetAgent).toBe('sales_pos');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies English best sellers query as sales_pos', () => {
      const result = classifier.classify('Who are our best sellers and top products this month?');
      expect(result.targetAgent).toBe('sales_pos');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Finance Domain Queries', () => {
    it('classifies Burmese profit & loss query as finance', () => {
      const result = classifier.classify('ပြီးခဲ့တဲ့လက အရှုံးအမြတ် စာရင်း ပြပေးပါ');
      expect(result.targetAgent).toBe('finance');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('classifies English balance sheet and aging query as finance', () => {
      const result = classifier.classify('Can you run the balance sheet and AR/AP aging report?');
      expect(result.targetAgent).toBe('finance');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Customer Service Domain Queries', () => {
    it('classifies Burmese apparel shopping query as customer_service', () => {
      const result = classifier.classify('အနက်ရောင် တီရှပ် အင်္ကျီ ဝယ်ချင်လို့ပါ');
      expect(result.targetAgent).toBe('customer_service');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('classifies English store return policy query as customer_service', () => {
      const result = classifier.classify('What is the return and exchange policy for dresses?');
      expect(result.targetAgent).toBe('customer_service');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('falls back safely to customer_service for ambiguous greetings', () => {
      const result = classifier.classify('Hello, mingalaba!');
      expect(result.targetAgent).toBe('customer_service');
    });
  });
});
