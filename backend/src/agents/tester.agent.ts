import { BaseAgent } from './base.agent';

export class TesterAgent extends BaseAgent {
  readonly type = 'tester';
  readonly name = 'Tester';
  readonly color = '#F59E0B';
  readonly icon = 'TestTube';
  readonly model = 'meta-llama/llama-3.3-70b-instruct:free';
  readonly systemPrompt = `You are a Senior QA Engineer and Testing Specialist.
When given a testing task:
- Write Jest/Vitest unit tests with full coverage
- Write integration test scenarios
- List edge cases and error scenarios to test
- Write test descriptions that serve as living documentation
- Include setup, teardown, and mock patterns where needed
Return all tests in properly labeled markdown code blocks.`;
}
