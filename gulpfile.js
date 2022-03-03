import { rollup } from 'rollup'
import { terser } from 'rollup-plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import gulp from 'gulp'
import rename from 'gulp-rename'

// store values globally
let cache = {};

// creates an ES module bundle
gulp.task('js-core', () => {
    return rollup({
        cache: cache.esm,
        input: [
            'static/js/extern.js',
            'static/js/article.js',
            'static/js/home.js',
            'static/js/math.js',
            'static/js/img.js',
            'static/js/bib.js',
            'static/js/index.js',
        ],
        plugins: [
            resolve({
                preferBuiltins: false,
            }),
            // terser(),
        ],
    }).then(bundle => {
        cache.esm = bundle.cache;
        return bundle.write({
            dir: './dist',
            preserveModules: true,
            preserveModulesRoot: 'static',
            format: 'es',
        });
    });
});

gulp.task('js-libs', () => gulp.src('./static/libs/*')
    .pipe(gulp.dest('./dist/libs'))
);

// all js
gulp.task('js', gulp.parallel('js-core', 'js-libs'));

// css themes
gulp.task('css-themes', () => gulp.src('./static/themes/**')
    .pipe(gulp.dest('./dist/themes'))
);

// css core
gulp.task('css-core', () => gulp.src(['./static/css/*.css'])
    .pipe(gulp.dest('./dist/css'))
);

// all css
gulp.task('css', gulp.parallel('css-themes', 'css-core'))

// images
gulp.task('image', () => gulp.src('./static/img/*')
    .pipe(gulp.dest('./dist/img'))
);

// favicon
gulp.task('favicon', () => gulp.src('./static/favicon/*')
    .pipe(gulp.dest('./dist/favicon'))
);

// features
gulp.task('feature', () => gulp.src('./static/features/*.gif')
    .pipe(gulp.dest('./dist/features'))
);

// all assets
gulp.task('asset', gulp.parallel('image', 'favicon', 'feature'));

// core fonts
gulp.task('core-fonts', () => gulp.src(['./static/css/fonts/*'])
    .pipe(gulp.dest('./dist/css/fonts'))
);

// gum font css
gulp.task('gum-fonts-css', () => gulp.src(['./node_modules/gum.js/css/fonts.css'])
    .pipe(rename('gum.css'))
    .pipe(gulp.dest('./dist/css'))
);

// gum fonts files
gulp.task('gum-fonts-data', () => gulp.src(['./node_modules/gum.js/css/fonts/*'])
    .pipe(gulp.dest('./dist/css/fonts'))
);

// gum fonts
gulp.task('gum-fonts', gulp.parallel('gum-fonts-css', 'gum-fonts-data'));

// katex font css
gulp.task('katex-fonts-css', () => gulp.src(['./node_modules/katex/dist/katex.min.css'])
    .pipe(rename('katex.css'))
    .pipe(gulp.dest('./dist/css'))
);

// katex fonts files
gulp.task('katex-fonts-data', () => gulp.src(['./node_modules/katex/dist/fonts/*'])
    .pipe(gulp.dest('./dist/css/fonts'))
);

// katex fonts
gulp.task('katex-fonts', gulp.parallel('katex-fonts-css', 'katex-fonts-data'));

// all fonts
gulp.task('fonts', gulp.parallel('core-fonts', 'gum-fonts', 'katex-fonts'));

// full build
gulp.task('build', gulp.parallel('js', 'css', 'fonts', 'asset'));

// development mode
gulp.task('dev', () => {
    gulp.watch(['static/js/*'], gulp.series('js'));
    gulp.watch(['static/css/*', 'static/themes/*'], gulp.series('css'));
    gulp.watch(['static/css/fonts/*', 'static/themes/fonts/*'], gulp.series('fonts'));
    gulp.watch(['static/img/*', 'static/favicon/*', 'static/features/*'], gulp.series('asset'));
});
