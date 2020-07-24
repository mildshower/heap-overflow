const request = require('supertest');
const { app } = require('../src/routes');

describe('GET', () => {
  context('/homepage', () => {
    it('Should get home page for path "/"', done => {
      request(app)
        .get('/')
        .set('Accept', '*/*')
        .expect(200)
        .expect('Content-Type', /text\/html/)
        .expect(/heapOverflow | Home/, done);
    });

    it('Should get home page for path "/home"', done => {
      request(app)
        .get('/home')
        .set('Accept', '*/*')
        .expect(200)
        .expect('Content-Type', /text\/html/)
        .expect(/heapOverflow | Home/, done);
    });

    it('should get public file for  the home page', done => {
      request(app)
        .get('/css/header.css')
        .set('accept', '*/*')
        .expect(200)
        .expect('Content-Type', /text\/css/)
        .expect(/#icon {/, done);
    });
  });
});