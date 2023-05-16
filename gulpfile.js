import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import gulp from 'gulp'
import rename from 'gulp-rename'
import connect from 'gulp-connect'

// store values globally
let cache = {};

// js-core for server framework
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
            'static/js/tagged.js',
        ],
        plugins: [
            resolve({
                preferBuiltins: false,
            }),
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

// json
gulp.task('json', () => gulp.src(['./static/json/*.json'])
    .pipe(gulp.dest('./dist/json'))
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
gulp.task('asset', gulp.parallel('image', 'favicon', 'feature', 'json'));

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

/**
 * pure parser and renderer
 */

// js-core for server framework
gulp.task('spirit-js', () => {
    return rollup({
        cache: cache.esm,
        input: [
            'static/js/markum.js',
            'static/js/spirit.js',
        ],
        plugins: [
            resolve({
                preferBuiltins: false,
            }),
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

// spirit css
gulp.task('spirit-css', () => gulp.src(['./static/css/markum.css', './static/css/spirit.css'])
    .pipe(gulp.dest('./dist/css'))
);

// spirit all
gulp.task('spirit-build', gulp.parallel('spirit-js', 'spirit-css'));

// spirit reload
gulp.task('spirit-reload', () => gulp.src(['index.html'])
    .pipe(connect.reload())
);

// spirit serve
gulp.task('spirit-serve', () => {
    connect.server({
        root: '.',
        port: 8000,
        host: 'localhost',
        livereload: true
    });

    gulp.watch(['index.html'], gulp.series('spirit-reload'));
    gulp.watch(['static/js/markum.js', 'static/js/spirit.js'], gulp.series('spirit-js'));
    gulp.watch(['static/css/markum.css', 'static/css/spirit.css'], gulp.series('spirit-css'));
});

// spirit devel mode
gulp.task('spirit-devel', gulp.series(['spirit-build', 'spirit-serve']));
