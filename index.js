'use strict';

var argv = require('argh').argv
  , kuler = require('kuler');

var toString = Object.prototype.toString;

/**
 *
 * @constructor
 * @param {String} namespace The namespace to prefix warnings.
 * @param {Object} options Additional and optional configuration.
 * @api public
 */
function Warnings(namespace, options) {
  if (!this) return new Warnings(namespace, options);
  options = options || {};

  this.disabled = [];
  this.namespace = namespace;
  this.warnings = Object.create(null);
  this.stream = options.stream || process.stderr;
  this.atty = 'atty' in options ? options.atty : (this.stream.fd
    ? require('tty').isatty(this.stream.fd)
    : true
  );
}

/**
 * Read out all the warnings from an local JSON or JS file. This makes it the
 * API a bit easier to work with and creates a more maintainable warning
 * structure.
 *
 * @param {String} path The location of a JSON file which contains your warnings.
 * @returns {Warnings}
 * @api public
 */
Warnings.prototype.read = function read(path) {
  var warnings = require(path);

  if (Array.isArray(warnings)) {
    warnings = warnings.reduce(function reduce(memo, warning) {
      memo[warning.name] = warning;
      return memo;
    }, {});
  }

  Object.keys(warnings).forEach(function each(warning) {
    this.set(warning.name, warning);
  }, this);

  return this;
};

/**
 * Add a new warning.
 *
 * @param {String} name The name/key of the warning.
 * @returns {Warnings}
 * @api public
 */
Warnings.prototype.set = function set(name, spec) {
  if (!spec.name) spec.name = name;
  this.warnings[name] = spec;

  return this;
};

/**
 * Give out a warning about a certain topic. If the topic has already been
 * warned about it will not be executed again.
 *
 * @param {String} key The key on which the information is stored.
 * @param {Mixed} what An optional value that we need to check against.
 * @returns {Boolean}
 * @api public
 */
Warnings.prototype.about = function about(key, what) {
  if (~this.disabled.indexOf(key) || !(key in this.warnings)) return false;

  var warning = this.warnings[key]
    , passed = false;

  delete this.warnings[key];

  //
  // Fast case, this warning should always be shown, it doesn't require any
  // conditional information.
  //
  if (!('conditional' in warning)) return this.write(warning.message);

  switch (toString.call(warning.conditional).slice(8, -1).toLowerCase()) {
    case 'function':
      passed = warning.conditional(what);
    break;

    case 'regexp':
      passed = warning.conditional.test(what);
    break;

    default:
      passed = what === warning.conditional;
  }

  //
  // It doesn't match the conditional check, so we shouldn't output this
  // warning.
  //
  if (!passed) return false;

  return this.write(warning.message);
};

/**
 * Write a message to the supplied stream.
 *
 * @param {String|Array} msg Output a message to the CLI.
 * @returns {Boolean}
 * @api private
 */
Warnings.prototype.write = function write(msg) {
  if (!Array.isArray(msg)) msg = msg.split('\n');

  //
  // Add some extra white space around the message so it's easier to spot in the
  // terminal as these error messages should be considered quite important.
  //
  msg.push('');
  msg.unshift('');

  return this.stream.write(msg.map(function map(line) {
    var prefix = this.namespace +': ';

    //
    // Color the prefix orange if the terminal allows colors.
    //
    if (this.atty) {
      prefix = kuler(prefix, '#EF7D43');
      line = kuler(line, '#FFFFFF');
    }

    return prefix + line;
  }, this).join('\n') + '\n');
};

/**
 * Disable certain warnings.
 *
 * @param {Object} options The various of
 * @returns {Warnings}
 * @api public
 */
Warnings.prototype.disable = function disable(options) {
  if (Array.isArray(options)) {
    Array.prototype.push.apply(this.disabled, options);
  } else if ('object' === typeof options) {
    return this.disable(Object.keys(options));
  } else {
    this.disabled.push(options);
  }

  return this;
};

/**
 * Destroy the warning instance, nuke all the things.
 *
 * @returns {Boolean}
 * @api public
 */
Warnings.prototype.destroy = function destroy() {
  if (!this.warnings) return false;

  this.namespace = this.warnings = this.stream = this.atty = null;
  return true;
};

//
// Expose the interface.
//
module.exports = Warnings;
