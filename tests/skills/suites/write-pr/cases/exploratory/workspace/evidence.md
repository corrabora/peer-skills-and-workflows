Report revision: 2222222222222222222222222222222222222222.
Log analysis: `node diagnostics/compare.mjs retained/oct18-19.json`, exit 0; 150 notifications, 3 duplicates, 1 duplicate near a retry. Complete input and output: https://example.test/beacon/evidence/log-comparison.
Replay: `node diagnostics/replay.mjs --duration-seconds 1200`, exit 0; 0 duplicates observed. Input, configuration and output: https://example.test/beacon/evidence/replay.
Report: https://example.test/beacon/blob/2222222222222222222222222222222222222222/reports/duplicate-notifications.md.
The commands completed the stated checks; zero duplicates during replay does not establish absence of a bug.
