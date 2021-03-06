/*
 * Copyright (c) 2012 Trent Mick. All rights reserved.
 *
 * Test `type: 'raw'` Logger streams.
 */
global.window = {
    navigator: {
        onLine: true,
        userAgent: 'chrime',
    },
    location: {
        href: '/wizzle-wuzzle-wup'
    }
};

import { test } from "babel-tap";

import { ServerStream } from '../src';

const MockXMLHttpRequest = require('mock-xmlhttprequest');
global.XMLHttpRequest = MockXMLHttpRequest;

test('default behavior', function (t) {
    let reqCount = 0;
    MockXMLHttpRequest.onSend = xhr => {
        t.equal(xhr.url, '/log');
        t.equal(xhr.method, 'PUT');
        t.equal(xhr.withCredentials, false);
        reqCount++;
        if(reqCount === 1) {
            const reqs = JSON.parse(xhr.body);
            t.equal(reqs.length, 2);
            t.equal(reqs[0].msg, 'one');
            t.equal(reqs[0].count, 2);
            t.equal(reqs[1].msg, 'two');
            t.equal(reqs[1].count, 1);
            t.equal(reqs[1].two, 'deux');
            xhr.respond(204);
        }

        if(reqCount === 2) {
            const reqs = JSON.parse(xhr.body);
            t.equal(reqs.length, 2);
            t.equal(reqs[0].msg, 'three');
            t.equal(reqs[1].msg, 'four');
            t.end();
        }
    };

    const stream = new ServerStream({ throttleInterval: 500 });

    stream.write({ msg: 'one' });
    stream.write({ msg: 'one' });
    stream.write({ two: 'deux', msg: 'two'});

    setTimeout(() => {
        stream.write({ msg: 'three' });
        setTimeout(() => {
            stream.write({ msg: 'four'});
        }, 100);
    }, 700);
});

test('customize behavior', function (t) {
    MockXMLHttpRequest.onSend = xhr => {
        t.equal(xhr.url, '/things');
        t.equal(xhr.method, 'POST');
        t.equal(xhr.withCredentials, true);

        const reqs = JSON.parse(xhr.body);
        t.equal(reqs.length, 3);

        t.end();
    };

    const stream = new ServerStream({
        throttleInterval: 10,
        method: 'POST',
        url: '/things',
        withCredentials: true,
    });
    stream.write({ msg: 'one' });
    stream.write({ msg: 'two' });
    stream.write({ msg: 'three' });
});

test('does not attempt to log offline', function (t) {
    window.navigator.onLine = false;
    let reqSent = false;
    MockXMLHttpRequest.onSend = () => {
        // this shouldn't happen
        reqSent = true;
    };

    const stream = new ServerStream({
        throttleInterval: 100
    });

    setTimeout(() => {
        t.equal(reqSent, false);
        window.navigator.onLine = true;
        stream.stop();
        t.end();
    }, 150);
});

test('custom xhr error handler', function (t) {
    MockXMLHttpRequest.onSend = xhr => {
        xhr.respond(400);
    };

    const stream = new ServerStream({
        throttleInterval: 100,
        onError: function(records, xhr) {
            t.equal(xhr.url, '/log');
            t.equal(records.length, 1);
            this.stop();
            t.end()
        },
    });
    stream.write({ msg: 'one' });
});