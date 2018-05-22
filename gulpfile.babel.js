import chalk from 'chalk';
import del from 'del';
import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import runSequence from 'run-sequence';
import flog from 'fancy-log';
import { find } from 'lodash';
import { spawn } from 'child_process';

import rollupConfig from './config/rollup.config';

const rollup = require('rollup');

const production = process.env.NODE_ENV === 'production';
const plugins = gulpLoadPlugins();

const paths = {
  js: ['src/js/**/*.js', 'node_modules/materialize-css/js/*.js'],
  scss: ['src/scss/*.scss'],
  copyOnly: [
    'src/index.html', 'src/parsepage.php',
    'src/css/style.css', 'src/img/**', 'src/vendor/**/*.+(css|js)']
};

const log = function log(...str) {
  const tag = this || find(gulp.tasks, { running: true }).name;
  flog(`[${chalk.cyan(tag)}] ${str.join(' ')}`);
  return true;
};

// Clean up dist and coverage directory
gulp.task('clean', () =>
  del.sync(['dist/**', 'dist/.*'])
);

// Copy non-js files to dist
gulp.task('copy', () =>
  gulp.src(paths.copyOnly)
    // .pipe(plugins.newer('dist'))
    .pipe(gulp.dest((file) => {
      if (file.history[0].endsWith('src/index.html')) {
        const contents = file._contents.toString()
          .replace(/\{\{useMinified\}\}/g, production ? '.min' : '');
        file._contents = new Buffer(contents); // eslint-disable-line no-param-reassign
      }
      return `dist/${file.base.replace(`${file.cwd}/src`, '')}`;
    }))
);

// Start server with restart on file changes
gulp.task('dev', ['rollup', 'copy', 'serve'], () =>
  plugins.watch('src/**/*.*', () => runSequence('copy', 'rollup'))
);

gulp.task('rollup', async () => {
  log.call('rollup', 'Bundling scripts...');
  const bundle = await rollup.rollup(rollupConfig);
  log.call('rollup', 'Writing bundle...');
  await bundle.write(rollupConfig.output);
  log.call('rollup', 'Done!');
});

gulp.task('serve', (done) => {
  const args = ['-S', 'localhost:8080', '-t', './dist/'];
  const httpServerProcess = spawn('php', args);
  httpServerProcess.stdout.on('data', data =>
    data.toString().trim().split('\n')
      .forEach(line => log.call('serve', line.includes('http') ? chalk.green(line) : line))
  );
  httpServerProcess.stderr.on('data', data => log(data.toString().trim()));
  done();
});

// default task: clean dist, compile js files and copy non-js files.
gulp.task('default', ['dev']);