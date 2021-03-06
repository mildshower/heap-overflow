const sinon = require('sinon');
const { assert } = require('chai');
const DataStore = require('../src/dataStore');

describe('dataStore', () => {
  context('#getQuestionDetails', () => {
    const knex = {
      select: () => knex,
      leftJoin: () => knex,
      with: () => knex,
      raw: () => knex,
      table: () => knex,
      from: () => knex,
      groupBy: () => knex,
      first: () => knex
    };

    it('it should give details of question when valid id provided', (done) => {
      knex.where = sinon.fake.resolves({ id: 1, title: 'question' });
      const dataStore = new DataStore({}, knex);
      dataStore.getQuestionDetails('1').then((details) => {
        assert.deepStrictEqual(details, { id: 1, title: 'question' });
        assert.ok(knex.where.calledOnce);
        done();
      });
    });

    it('it should produce error when invalid id is given', (done) => {
      knex.where = sinon.fake.resolves({ id: null});
      const dataStore = new DataStore({}, knex);
      dataStore.getQuestionDetails('1').catch((err) => {
        assert.deepStrictEqual(err.message, 'Wrong Id Provided');
        assert.ok(knex.where.calledOnce);
        done();
      });
    });
  });

  context('#init', () => {
    it('it should run database initiation sql', (done) => {
      const dbClient = {
        exec: sinon.fake.yields(),
      };
      const dataStore = new DataStore(dbClient);
      dataStore.init().then(() => {
        assert.ok(dbClient.exec.calledOnce);
        assert.ok(dbClient.exec.firstArg.match(/PRAGMA foreign_keys=ON/));
        done();
      });
    });
  });

  context('#getLastQuestions', () => {
    it('it should give last question id\'s if valid count is given', (done) => {
      const dbClient = {
        all: sinon.fake.yields(null, [
          { id: 1 },
          { id: 2 },
          { id: 3 },
          { id: 4 },
        ]),
      };
      const dataStore = new DataStore(dbClient);
      dataStore.getLastQuestions(2).then((questionIds) => {
        assert.deepStrictEqual(questionIds, [{ id: 1 }, { id: 2 }]);
        assert.ok(dbClient.all.calledOnce);
        assert.ok(dbClient.all.firstArg.match(/order by ques\.created DESC/));
        done();
      });
    });

    it('it should produce error when invalid count is provided', (done) => {
      const dataStore = new DataStore({});
      dataStore.getLastQuestions(-1).catch((error) => {
        assert.deepStrictEqual(error.message, 'Invalid Count');
        done();
      });
    });
  });

  context('#addQuestionTags', () => {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    it('it should add tags', (done) => {
      knex.first = sinon.fake.resolves(undefined);
      knex.insert = sinon.fake.resolves([1]);

      dataStore.addQuestionTags(1, ['tag']).then(() => {
        assert.ok(knex.table.calledWith('questions_tags'));
        assert.ok(knex.insert.calledWith({ 'tag_name': 'tag' }));
        assert.ok(knex.insert.calledWith({ 'tag_id': 1, 'question_id': 1 }));
        done();
      });
    });

    it('it should get tags without adding if tag is already exists', (done) => {
      knex.first = sinon.fake.resolves({ id: 1 });

      dataStore.addQuestionTags(1, ['tag']).then(() => {
        assert.ok(knex.table.calledWith('questions_tags'));
        assert.ok(knex.insert.calledWith({ 'tag_id': 1, 'question_id': 1 }));
        done();
      });
    });

    it('it should give error when addition of tags doesn\'t happen', (done) => {
      knex.first = sinon.fake.resolves(undefined);
      const insert = sinon.stub();
      insert.withArgs({ 'tag_name': 'tag' }).resolves([1]);
      insert.withArgs({ 'tag_id': 1, 'question_id': 1 }).rejects();
      knex.insert = insert;

      dataStore.addQuestionTags(1, ['tag']).catch(() => {
        assert.ok(knex.table.calledWith('questions_tags'));
        assert.ok(knex.insert.calledWith({ 'tag_name': 'tag' }));
        assert.ok(knex.insert.calledWith({ 'tag_id': 1, 'question_id': 1 }));
        done();
      });
    });
  });

  context('#addQuestionContent', () => {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    it('it should add a question when valid owner given', (done) => {
      knex.insert = sinon.fake.resolves([1]);

      dataStore
        .addQuestionContent(
          { title: 'title', body: 'body', bodyText: 'body' },
          1
        )
        .then((details) => {
          assert.deepStrictEqual(details, { id: 1 });
          assert.ok(knex.table.calledWith('questions'));
          assert.ok(knex.insert.calledWith({
            title: 'title', body: 'body',
            'body_text': 'body', owner: 1
          }));
          done();
        });
    });

    it('it should produce error if wrong owner is given', (done) => {
      knex.insert = sinon.fake.rejects();
      dataStore
        .addQuestionContent(
          { title: 'title', body: 'body', bodyText: 'body' },
          10
        )
        .catch((err) => {
          assert.deepStrictEqual(err.message, 'Question Insertion Incomplete!');
          assert.ok(knex.table.calledWith('questions'));
          assert.ok(knex.insert.calledWith({
            title: 'title', body: 'body',
            'body_text': 'body', owner: 10
          }));
          done();
        });
    });
  });

  context('#addQuestion', () => {
    it('it should add question', (done) => {
      const dataStore = new DataStore({});

      const fakeAddQuestionContent = sinon
        .stub(dataStore, 'addQuestionContent')
        .resolves({ id: 1 });

      const fakeAddQuestionTags = sinon
        .stub(dataStore, 'addQuestionTags')
        .resolves();

      const question = {
        title: 'title', body: 'body', bodyText: 'bodyText', tags: ['tag']
      };

      dataStore
        .addQuestion(question, 1)
        .then((details) => {
          assert.deepStrictEqual(details, { id: 1 });
          assert.ok(fakeAddQuestionContent.calledOnceWith(question, 1));
          assert.ok(fakeAddQuestionTags.calledOnceWith(1, ['tag']));
          done();
        });
    });
  });

  context('#addNewUser', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    const name = 'testUser';
    const avatar = 'avatarUrl.com/u/58025792?v=4';

    it('should add a new user to database', (done) => {
      knex.insert = sinon.fake.resolves([1]);

      dataStore.addNewUser(name, avatar).then((actual) => {
        assert.deepStrictEqual(actual, { id: 1 });
        assert.ok(knex.table.calledWith('users'));
        assert.ok(knex.insert.calledWith({ 'github_username': name, avatar }));
        done();
      });
    });

    it('should not add a user when the user already present', (done) => {
      knex.insert = sinon.fake.rejects();

      const message = 'User Already Exists!';
      dataStore.addNewUser(name, avatar).catch((err) => {
        assert.equal(err.message, message);
        assert.ok(knex.table.calledWith('users'));
        assert.ok(knex.insert.calledWith({ 'github_username': name, avatar }));
        done();
      });
    });
  });

  describe('#getUser', function() {

    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.select = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);
    knex.first = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should get user details when the user is in present', (done) => {
      const details = {
        user: {
          github_username: 'testUser',
          avatar: 'avatarUrl.com/u/58025792?v=4',
          github_link: 'http://github.com/testUser',
          bio: null,
          display_name: 'USER',
          email: null,
          location: null,
          role: 'user',
          id: 4,
        },
        isFound: true,
      };

      knex.then = () => Promise.resolve(details);

      dataStore.getUser('github_username', 'testUser')
        .then(actual => {
          assert.deepStrictEqual(actual, details);
          assert.ok(knex.table.calledWith('users'));
          assert.ok(knex.select.calledWith());
          assert.ok(knex.where.calledWith('github_username', 'testUser'));
          done();
        });
    });

    it('should get user details undefined when the user is in not present', (done) => {

      knex.then = () => Promise.resolve({ user: undefined, isFound: false });

      dataStore.getUser('github_username', 'noUser')
        .then(actual => {
          assert.deepStrictEqual(actual, { user: undefined, isFound: false });
          assert.ok(knex.table.calledWith('users'));
          assert.ok(knex.select.calledWith());
          assert.ok(knex.where.calledWith('github_username', 'noUser'));
          done();
        });
    });

    it('Should give error if we given key is not present', (done) => {
      const message = 'no such column: github_user';
      knex.then = () => Promise.reject(new Error(message));

      dataStore.getUser('github_user', 'noUser')
        .catch(err => {
          assert.deepStrictEqual(err.message, message);
          assert.ok(knex.table.calledWith('users'));
          assert.ok(knex.select.calledWith());
          assert.ok(knex.where.calledWith('github_user', 'noUser'));
          done();
        });
    });
  });

  context('#updateUserDetails', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.update = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    const name = 'testUser';
    const email = 'testUser.com';
    const location = 'Bangalore';

    it('should update details of a user to database', (done) => {
      knex.where = sinon.fake.resolves(undefined);
      dataStore
        .updateUserDetails(4, { name, email, location, bio: '' })
        .then(() => {
          assert.ok(knex.table.calledWith('users'));
          assert.ok(knex.update.calledWith({
            'display_name': name, email, location, bio: ''
          }));
          assert.ok(knex.where.calledWith('id', 4));
          done();
        });
    });

    it('should produce error while db query produces', (done) => {
      knex.where = sinon.fake.rejects();
      dataStore.updateUserDetails(4, {
        name, email, location, bio: ''
      }).catch(() => {
        assert.ok(knex.table.calledWith('users'));
        assert.ok(knex.update.calledWith({
          'display_name': name, email, location, bio: ''
        }));
        assert.ok(knex.where.calledWith('id', 4));
        done();
      });
    });
  });

  context('#getUserQuestions', function() {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    const questions = [
      {
        id: 1,
        title: 'How to write arrow functions',
        body_text: 'here is a sample function',
      },
    ];

    it('should give all the questions of a particular', (done) => {
      knex.where = sinon.fake.resolves(questions);

      dataStore.getUserQuestions(1).then((actual) => {
        assert.deepStrictEqual(actual, questions);
        assert.ok(knex.from.calledWith('questions'));
        assert.ok(knex.where.calledWith('questions.owner', 1));
        done();
      });
    });

    it('should produce error while db produces error', (done) => {
      knex.where = sinon.fake.rejects();

      dataStore.getUserQuestions(1).catch(() => {
        assert.ok(knex.from.calledWith('questions'));
        assert.ok(knex.where.calledWith('questions.owner', 1));
        done();
      });
    });
  });

  context('#getMatchedQuestions', function() {
    it('should give all the questions of a particular query', (done) => {
      const questions = [
        {
          id: 1,
          title: 'How to write arrow functions',
          body_text: 'here is a sample function',
        },
      ];
      const dbClient = {
        all: sinon.fake.yields(null, questions),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getMatchedQuestions('arrow').then((actual) => {
        assert.deepStrictEqual(actual, questions);
        assert.ok(dbClient.all.calledOnce);
        assert.include(dbClient.all.args[0][1], { $text: '%arrow%' });
        done();
      });
    });

    it('should give all the questions of a particular user', (done) => {
      const questions = [
        {
          id: 1,
          title: 'How to write arrow functions',
          body_text: 'here is a sample function',
          ownerName: 'john',
        },
      ];
      const dbClient = {
        all: sinon.fake.yields(null, questions),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getMatchedQuestions('@john').then((actual) => {
        assert.deepStrictEqual(actual, questions);
        assert.ok(dbClient.all.calledOnce);
        assert.include(dbClient.all.args[0][1], { $user: '%john%' });
        done();
      });
    });

    it('should give all the questions which has searched tag', (done) => {
      const questions = [
        {
          id: 1,
          title: 'How to write arrow functions',
          body_text: 'here is a sample function',
          ownerName: 'john',
        },
      ];
      const dbClient = {
        all: sinon.fake.yields(null, questions),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getMatchedQuestions('#javascript').then((actual) => {
        assert.deepStrictEqual(actual, questions);
        assert.ok(dbClient.all.calledOnce);
        assert.include(dbClient.all.args[0][1], {
          $tag: '%javascript%',
        });
        done();
      });
    });

    it('should give all the questions which has correct answer', (done) => {
      const questions = [
        {
          id: 1,
          title: 'How to write arrow functions',
          body_text: 'here is a sample function',
          ownerName: 'john',
        },
      ];
      const dbClient = {
        all: sinon.fake.yields(null, questions),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getMatchedQuestions(':accepted').then((actual) => {
        assert.deepStrictEqual(actual, questions);
        assert.ok(dbClient.all.calledOnce);
        assert.include(dbClient.all.args[0][1], {
          $acceptance: 1,
        });
        done();
      });
    });
  });

  context('#getAnswersByQuestion', function() {
    it('should give all the answers of a particular question', (done) => {
      const answers = [{ id: 1 }];
      const dbClient = {
        all: sinon.fake.yields(null, answers),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getAnswersByQuestion(1).then((actual) => {
        assert.deepStrictEqual(actual, answers);
        assert.ok(dbClient.all.calledOnce);
        assert.deepStrictEqual(dbClient.all.args[0][1], [1]);
        done();
      });
    });
  });

  context('#getVote', function() {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);
    knex.andWhere = sinon.fake.returns(knex);
    knex.first = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should give voteType when valid user and question id given', (done) => {
      knex.then = sinon.fake.resolves({ isVoted: true, voteType: 0 });

      dataStore.getVote(1, 1, true).then((actual) => {
        assert.deepStrictEqual(actual, { isVoted: true, voteType: 0 });
        assert.ok(knex.from.calledWith('question_votes'));
        assert.ok(knex.where.calledWith('question_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        done();
      });
    });

    it('should give voteType when valid user and answer id given', (done) => {
      knex.then = sinon.fake.resolves({ isVoted: true, voteType: 0 });

      dataStore.getVote(1, 1).then((actual) => {
        assert.deepStrictEqual(actual, { isVoted: true, voteType: 0 });
        assert.ok(knex.from.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        done();
      });
    });

    it('should give no vote if invalid ids given', (done) => {
      knex.then = sinon.fake.resolves({ isVoted: false, voteType: undefined });

      dataStore.getVote(300, 300).then((actual) => {
        assert.deepStrictEqual(actual, { isVoted: false, voteType: undefined });
        assert.ok(knex.from.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 300));
        assert.ok(knex.andWhere.calledWith('user', 300));
        done();
      });
    });

    it('should produce error if database produces', (done) => {
      knex.first = sinon.fake.rejects('Fetching vote failed');

      dataStore.getVote(300, 300).catch((err) => {
        assert.deepStrictEqual(err.message, 'Fetching vote failed');
        assert.ok(knex.from.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 300));
        assert.ok(knex.andWhere.calledWith('user', 300));
        done();
      });
    });
  });

  context('#getUserAnswers', function() {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.leftJoin = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    const details = [{
      id: 1,
      body: 'body',
      body_text: 'body',
      question: 1,
      owner: 1,
      is_accepted: 0,
      questionTitle: 'question'
    }];

    it('should give all the answers of a particular user', (done) => {
      knex.where = sinon.fake.resolves(details);

      dataStore.getUserAnswers(1).then((actual) => {
        assert.deepStrictEqual(actual, details);
        assert.ok(knex.from.calledWith('answers'));
        assert.ok(knex.where.calledWith('answers.owner', 1));
        done();
      });
    });

    it('should produce error while db produces error', (done) => {
      knex.where = sinon.fake.rejects();

      dataStore.getUserAnswers(1).catch(() => {
        assert.ok(knex.from.calledWith('answers'));
        assert.ok(knex.where.calledWith('answers.owner', 1));
        done();
      });
    });
  });

  context('#addAnswer', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.insert = sinon.fake.resolves([1]);

    const dataStore = new DataStore(dbClient, knex);

    it('should add the answer without throwing error', (done) => {

      dataStore.addAnswer('body', 'bodyText', 1, 1).then(([id]) => {
        assert.equal(id, 1);
        assert.ok(knex.table.calledWith('answers'));
        done();
      });
    });

    it('should produce error when insertion failed', (done) => {
      knex.insert = sinon.fake.rejects();

      dataStore.addAnswer('body', 'bodyText', 100, 1).catch((err) => {
        assert.deepStrictEqual(err.message, 'Answer Insertion Failed!');
        assert.ok(knex.table.calledWith('answers'));
        done();
      });
    });
  });

  context('#saveComment', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.insert = sinon.fake.resolves([1]);

    const dataStore = new DataStore(dbClient, knex);

    it('should add the answer comment', (done) => {
      dataStore.saveComment({
        body: 'body', owner: 1, id: 1, creationTime: '2020-12-12 12:34:21'
      }).then(([id]) => {
        assert.equal(id, 1);
        assert.ok(knex.table.calledWith('answer_comments'));
        assert.ok(knex.insert.calledWith({
          body: 'body', owner: 1, answer: 1, created: '2020-12-12 12:34:21',
          'last_modified': '2020-12-12 12:34:21'
        }));
        done();
      });
    });

    it('should add the question comment', (done) => {

      dataStore.saveComment({
        body: 'body', owner: 1, id: 1, creationTime: '2020-12-12 12:34:21'
      }, true).then(([id]) => {
        assert.equal(id, 1);
        assert.ok(knex.table.calledWith('question_comments'));
        assert.ok(knex.insert.calledWith({
          body: 'body', owner: 1, question: 1, created: '2020-12-12 12:34:21',
          'last_modified': '2020-12-12 12:34:21'
        }));
        done();
      });
    });

    it('should produce error when insertion failed', (done) => {

      const message = 'Comment Insertion Failed!';
      knex.insert = sinon.fake.returns(Promise.reject(message));

      dataStore.saveComment({
        body: 'body', owner: 1, id: 1, creationTime: '2020-12-12 12:34:21'
      }).catch(err => {
        assert.deepStrictEqual(err.message, message);
        assert.ok(knex.table.calledWith('answer_comments'));
        done();
      });
    });
  });

  context('#getQuestionTags', () => {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.leftJoin = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should give all the tags used in questions', (done) => {
      knex.pluck = sinon.fake.resolves(['sqlite3', 'javascript']);

      dataStore.getQuestionTags(1).then((tags) => {
        assert.deepStrictEqual(tags, ['sqlite3', 'javascript']);
        assert.ok(knex.select.calledWith('tags.tag_name'));
        assert.ok(knex.from.calledWith('tags'));
        done();
      });
    });
  });

  context('#addVote', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.update = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);
    this.afterEach(() => sinon.restore());
    it('should add a question vote when valid credentials given', (done) => {
      knex.insert = sinon.fake.resolves([1]);
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: false });

      dataStore.addVote(1, 1, 1, true).then(([id]) => {
        assert.equal(id, 1);
        assert.ok(knex.table.calledWith('question_votes'));
        assert.ok(knex.insert.calledWith({
          vote_type: 1, question_id: 1, user: 1
        }));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, true]);
        done();
      });
    });

    it('should add a answer vote when valid credentials given', (done) => {
      knex.insert = sinon.fake.resolves([1]);
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: false });

      dataStore.addVote(1, 1, 1, false).then(([id]) => {
        assert.equal(id, 1);
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.insert.calledWith({
          vote_type: 1, answer_id: 1, user: 1
        }));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, false]);
        done();
      });
    });

    it('should modify a question vote when same question user pair exists', (done) => {
      knex.andWhere = sinon.fake.resolves();
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: true });

      dataStore.addVote(1, 1, 1, true).then(() => {
        assert.ok(knex.table.calledWith('question_votes'));
        assert.ok(knex.update.calledWith('vote_type', 1));
        assert.ok(knex.where.calledWith('question_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, true]);
        done();
      });
    });

    it('should modify a answer vote when same answer user pair exists', (done) => {
      knex.andWhere = sinon.fake.resolves();
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: true });

      dataStore.addVote(1, 1, 1, false).then(() => {
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.update.calledWith('vote_type', 1));
        assert.ok(knex.where.calledWith('answer_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, false]);
        done();
      });
    });

    it('should produce error when vote addition failed', (done) => {
      knex.insert = sinon.fake.rejects();
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: false });

      dataStore.addVote(1, 1, 1, false).catch((err) => {
        assert.equal(err.message, 'Vote Addition Failed');
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.insert.calledWith({
          vote_type: 1, answer_id: 1, user: 1
        }));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, false]);
        done();
      });
    });

    it('should produce error when updation failed', (done) => {
      knex.andWhere = sinon.fake.rejects();
      const stubbedGetVote = sinon
        .stub(dataStore, 'getVote')
        .resolves({ isVoted: true });

      dataStore.addVote(1, 1, 1, false).catch((err) => {
        assert.equal(err.message, 'Vote Updation Failed');
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.update.calledWith('vote_type', 1));
        assert.ok(knex.where.calledWith('answer_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        assert.ok(stubbedGetVote.calledOnce);
        assert.deepStrictEqual(stubbedGetVote.args[0], [1, 1, false]);
        done();
      });
    });
  });

  context('#deleteVote', function() {
    const dbClient = () => { };
    const knex = {};
    knex.table = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);
    knex.andWhere = sinon.fake.returns(knex);
    knex.del = sinon.fake.resolves();

    const dataStore = new DataStore(dbClient, knex);

    it('should delete a question vote when valid credentials given', (done) => {
      dataStore.deleteVote(1, 1, true).then(() => {
        assert.ok(knex.table.calledWith('question_votes'));
        assert.ok(knex.where.calledWith('question_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        done();
      });
    });

    it('should delete a answer vote when valid credentials given', (done) => {
      dataStore.deleteVote(1, 1).then(() => {
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 1));
        assert.ok(knex.andWhere.calledWith('user', 1));
        done();
      });
    });

    it('should produce error when invalid credentials given', (done) => {
      knex.del = sinon.fake.rejects();
      dataStore.deleteVote(100, 100).catch((err) => {
        assert.deepStrictEqual(err.message, 'Vote Deletion Failed');
        assert.ok(knex.table.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 100));
        assert.ok(knex.andWhere.calledWith('user', 100));
        done();
      });
    });
  });

  context('#getVoteCount', function() {

    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);
    knex.raw = sinon.fake.returns(knex);
    knex.first = sinon.fake.resolves({ voteCount: 10 });

    const dataStore = new DataStore(dbClient, knex);

    it('should give question vote count for a question', (done) => {

      dataStore.getVoteCount(1, true).then((voteCount) => {
        assert.deepStrictEqual(voteCount, { voteCount: 10 });
        assert.ok(knex.from.calledWith('question_votes'));
        assert.ok(knex.where.calledWith('question_id', 1));
        done();
      });
    });

    it('should give answer vote count for a answer', (done) => {

      dataStore.getVoteCount(1).then((voteCount) => {
        assert.deepStrictEqual(voteCount, { voteCount: 10 });
        assert.ok(knex.from.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 1));
        done();
      });
    });

    it('should produce error when database produces', (done) => {
      knex.first = sinon.fake.rejects();

      dataStore.getVoteCount(100).catch((err) => {
        assert.deepStrictEqual(err.message, 'Vote Count Fetching Error');
        assert.ok(knex.from.calledWith('answer_votes'));
        assert.ok(knex.where.calledWith('answer_id', 100));
        done();
      });
    });
  });

  context('#rejectAnswer', function() {

    const dbClient = () => { };
    const knex = {};

    knex.table = sinon.fake.returns(knex);
    knex.update = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should reject an answer', (done) => {
      knex.where = sinon.fake.resolves();

      dataStore.rejectAnswer(1).then(() => {
        assert.ok(knex.table.calledWith('answers'));
        assert.ok(knex.update.calledWith('is_accepted', 0));
        assert.ok(knex.where.calledWith('id', 1));
        done();
      });
    });

    it('should not reject an answer when invalid answer id given', (done) => {
      knex.where = sinon.fake.rejects();

      dataStore.rejectAnswer(2454).catch(() => {
        assert.ok(knex.table.calledWith('answers'));
        assert.ok(knex.update.calledWith('is_accepted', 0));
        assert.ok(knex.where.calledWith('id', 2454));
        done();
      });
    });
  });

  context('#acceptAnswer', function() {
    const dbClient = () => { };
    const knex = {};

    const where = sinon.stub();
    where.withArgs('id', 1).returns(knex);
    where.withArgs('question', 1).resolves();
    where.withArgs('question', 2454).rejects();

    knex.table = sinon.fake.returns(knex);
    knex.select = sinon.fake.returns(knex);
    knex.where = where;
    knex.first = sinon.fake.resolves({ question: 1 });
    knex.update = sinon.fake.returns(knex);
    knex.raw = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should accept an answer', (done) => {

      dataStore.acceptAnswer(1).then(() => {
        assert.equal(knex.table.args[0], 'answers');
        assert.equal(knex.table.args[1], 'answers');
        done();
      });
    });

    it('should not accept an answer when invalid answer id given', (done) => {
      knex.first = sinon.fake.resolves({ question: 2454 });
      dataStore.acceptAnswer(1).catch(() => {
        assert.equal(knex.table.args[0], 'answers');
        assert.equal(knex.table.args[1], 'answers');
        done();
      });
    });
  });

  context('#getAnswerById', function() {
    it('should serve answer Details', (done) => {
      const dbClient = {
        get: sinon.fake.yields(null, { id: 1 }),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getAnswerById(1).then((details) => {
        assert.deepStrictEqual(details, { id: 1 });
        assert.ok(dbClient.get.calledOnce);
        assert.deepStrictEqual(dbClient.get.args[0][1], [1]);
        done();
      });
    });

    it('should produce error while invalid id is given', (done) => {
      const dbClient = {
        get: sinon.fake.yields(null, undefined),
      };
      const dataStore = new DataStore(dbClient);

      dataStore.getAnswerById(100).catch((err) => {
        assert.deepStrictEqual(err.message, 'Wrong Id Provided');
        assert.ok(dbClient.get.calledOnce);
        assert.deepStrictEqual(dbClient.get.args[0][1], [100]);
        done();
      });
    });
  });

  context('#getComments', function() {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.leftJoin = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should serve question comments when isQuestion is true', (done) => {
      const details = [{ ownerName: 'testUser' }];
      knex.where = sinon.fake.resolves(details);

      dataStore.getComments(1, true).then((actual) => {
        assert.deepStrictEqual(actual, details);
        assert.ok(knex.from.calledWith({ comments: 'question_comments' }));
        assert.ok(knex.where.calledWith('comments.question', 1));
        done();
      });
    });

    it('should serve answer comments when isQuestion is false', (done) => {
      const details = [{ ownerName: 'testUser' }];
      knex.where = sinon.fake.resolves(details);

      dataStore.getComments(1, false).then((actual) => {
        assert.deepStrictEqual(actual, details);
        assert.ok(knex.from.calledWith({ comments: 'answer_comments' }));
        assert.ok(knex.where.calledWith('comments.answer', 1));
        done();
      });
    });
  });

  context('#getPopularTags', function() {
    const dbClient = () => { };
    const knex = {};
    knex.select = sinon.fake.returns(knex);
    knex.count = sinon.fake.returns(knex);
    knex.from = sinon.fake.returns(knex);
    knex.leftJoin = sinon.fake.returns(knex);
    knex.where = sinon.fake.returns(knex);
    knex.groupBy = sinon.fake.returns(knex);
    knex.orderBy = sinon.fake.returns(knex);
    knex.pluck = sinon.fake.returns(knex);

    const dataStore = new DataStore(dbClient, knex);

    it('should get all matched popular tags', (done) => {

      knex.limit = () => Promise.resolve(['javascript']);

      dataStore.getPopularTags('java', 10)
        .then(actual => {
          assert.deepStrictEqual(actual, ['javascript']);
          assert.ok(knex.select.calledWith('tag_name'));
          assert.ok(knex.from.calledWith('questions_tags'));
          assert.ok(knex.where.calledWith('tag_name', 'like', '%java%'));
          done();
        });
    });
  });
});
