import assert from 'node:assert/strict';
import { parseCaptions } from '../src/features/video/captionParser.ts';

const vtt = `WEBVTT\n\n00:00:03.500 --> 00:00:06.000\nمرحباً &amp; أهلاً<br>بكم\n\n00:01:12.000 --> 00:01:16.000\nالفكرة الثانية`;
assert.equal(parseCaptions(vtt), '[00:00:03.500] مرحباً & أهلاً بكم\n[00:01:12.000] الفكرة الثانية');

const srt = `1\n00:02:05,250 --> 00:02:08,000\nمرحلة أولى\n\n2\n00:03:10,000 --> 00:03:12,000\nمرحلة ثانية`;
assert.equal(parseCaptions(srt), '[00:02:05.250] مرحلة أولى\n[00:03:10.000] مرحلة ثانية');

assert.equal(parseCaptions('سطر أول\nسطر ثانٍ'), 'سطر أول\nسطر ثانٍ');
console.log('YouTube VTT/SRT timestamp parsing passed.');
