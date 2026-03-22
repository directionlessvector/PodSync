const { signup } = require('./signupController');
const { login } = require('./loginController');
const { profile } = require('./profileController');

module.exports = {
  signup,
  login,
  profile,
};