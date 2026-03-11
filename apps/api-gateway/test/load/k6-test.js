/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* global __ENV, __VU, __ITER */
import http from 'k6/http';
import { check, sleep } from 'k6';

// Read configuration from environment variables or use defaults
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'sk-test-valid-key';

export const options = {
  // Scenario 1: Ramp up to 500 concurrent users for a stress test
  stages: [
    { duration: '10s', target: 50 }, // Ramp-up to 50 users over 10 seconds
    { duration: '30s', target: 500 }, // Ramp-up to 500 users over 30 seconds
    { duration: '30s', target: 500 }, // Stay at 500 users for 30 seconds (peak)
    { duration: '10s', target: 0 }, // Ramp-down to 0 users
  ],
  thresholds: {
    // 95% of requests must receive the first byte (TTFT) within 1 second.
    // NOTE: This measures gateway latency + upstream time-to-first-token.
    // We use waiting time instead of duration because duration includes the entire stream generation.
    http_req_waiting: ['p(95)<1000'],
    // Less than 1% of requests should fail
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = `${BASE_URL}/v1/chat/completions`;

  const payload = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content:
          'Generate a short 3 sentence summary of the history of computing.',
      },
    ],
    // Test the streaming endpoint specifically as this is where Node.js struggles the most
    stream: true,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      // Pass a custom trace ID to trace requests in logs if needed
      'trace-id': `k6-stress-test-${__VU}-${__ITER}`,
    },
    // Required to capture streaming responses properly in K6
    responseType: 'text',
  };

  const res = http.post(url, payload, params);

  // Validate the response
  check(res, {
    'status is 200': (r) => r.status === 200,
    'is SSE stream': (r) =>
      r.headers['Content-Type'] &&
      r.headers['Content-Type'].includes('text/event-stream'),
    // Verify that data chunks were actually received (basic check for SSE format)
    'received data chunks': (r) => r.body && r.body.includes('data:'),
  });

  // Small delay to simulate real user behavior between requests (prevents overwhelming the local network stack instantly)
  sleep(Math.random() * 0.5 + 0.1);
}
