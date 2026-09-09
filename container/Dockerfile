ARG STACK_VERSION=24
FROM heroku/heroku:$STACK_VERSION
USER root

ARG STACK_VERSION
RUN test "$STACK_VERSION" = 24

ENV DEBIAN_FRONTEND=noninteractive

# Release-builder tools only. The buildpack installs the archive below, not
# this container; Meson, Ninja and compilers never enter the app slug.
RUN apt-get update && apt-get install -y \
  build-essential \
  git \
  meson \
  cmake \
  ninja-build \
  intltool \
  libtool \
  pkg-config

# heroku buildpacks include some libraries, like tiff and jpeg, as part of the
# run-time platform, and we want to use those libs if we can
#
# see https://devcenter.heroku.com/articles/stack-packages
#
# libgsf needs libxml2
RUN apt-get update && apt-get install -y \
  libglib2.0-dev \
  libexpat-dev \
  libpango1.0-dev \
  librsvg2-dev \
  libjpeg-turbo8-dev \
  libopenjp2-7-dev \
  libopenexr-dev \
  libtiff-dev \
  libexif-dev \
  liblcms2-dev \
  libxml2-dev \
  libfftw3-dev \
  libwebp-dev

# build our stack to this prefix
ARG VIPS_PREFIX=/usr/local/vips

# ld and pkg-config need to pick up packages from this area
ENV LD_LIBRARY_PATH=$VIPS_PREFIX/lib
ENV PKG_CONFIG_PATH=$VIPS_PREFIX/lib/pkgconfig

# build area
WORKDIR /usr/local/src

# build liborc
ARG ORC_VERSION=0.4.34
ARG ORC_URL=https://gstreamer.freedesktop.org/src/orc

RUN wget ${ORC_URL}/orc-$ORC_VERSION.tar.xz \
  && tar xf orc-${ORC_VERSION}.tar.xz \
  && cd orc-${ORC_VERSION} \
  && meson build --prefix=${VIPS_PREFIX} --libdir=lib --buildtype=release \
  && cd build \
  && ninja \
  && ninja install

# build libgsf
ARG GSF_VERSION=1.14.50
ARG GSF_URL=https://download.gnome.org/sources/libgsf

RUN wget ${GSF_URL}/${GSF_VERSION%.*}/libgsf-$GSF_VERSION.tar.xz \
  && tar xf libgsf-${GSF_VERSION}.tar.xz \
  && cd libgsf-${GSF_VERSION} \
  && ./configure --prefix=$VIPS_PREFIX --disable-gtk-doc \
  && make V=0 \
  && make install

# build libimagequant
ARG IMAGEQUANT_VERSION=ce5fdeb1ccd9db288950faa21fd09c42c0a59bbb
ARG IMAGEQUANT_URL=https://github.com/lovell/libimagequant

RUN git clone $IMAGEQUANT_URL \
  && cd libimagequant \
  && git checkout $IMAGEQUANT_VERSION \
  && meson build --prefix=${VIPS_PREFIX} --libdir=lib --buildtype=release \
  && cd build \
  && ninja \
  && ninja install

# build libcgif
ARG CGIF_VERSION=0.3.2
ARG CGIF_URL=https://github.com/dloebl/cgif/archive/refs/tags

RUN wget ${CGIF_URL}/V${CGIF_VERSION}.tar.gz \
  && tar xf V${CGIF_VERSION}.tar.gz \
  && cd cgif-${CGIF_VERSION} \
  && meson build --prefix=${VIPS_PREFIX} --libdir=lib --buildtype=release \
  && cd build \
  && ninja \
  && ninja install

# build libspng
ARG SPNG_VERSION=0.7.4
ARG SPNG_URL=https://github.com/randy408/libspng/archive/refs/tags

RUN wget ${SPNG_URL}/v${SPNG_VERSION}.tar.gz \
  && tar xf v${SPNG_VERSION}.tar.gz \
  && cd libspng-${SPNG_VERSION} \
  && meson build --prefix=${VIPS_PREFIX} --libdir=lib --buildtype=release \
  && cd build \
  && ninja \
  && ninja install

# build libde265
ARG DE265_VERSION=1.0.12
ARG DE265_URL=https://github.com/strukturag/libde265/releases/download

RUN wget ${DE265_URL}/v${DE265_VERSION}/libde265-${DE265_VERSION}.tar.gz \
  && tar xf libde265-${DE265_VERSION}.tar.gz \
  && cd libde265-${DE265_VERSION} \
  && ./autogen.sh \
  && ./configure --prefix=$VIPS_PREFIX \
  && make V=0 \
  && make install

# build libx265
ARG X265_VERSION=3.5
ARG X265_URL=https://download.videolan.org/pub/videolan/x265
ARG X265_SHA256=e70a3335cacacbba0b3a20ec6fecd6783932288ebc8163ad74bcc9606477cae8

RUN wget ${X265_URL}/x265_${X265_VERSION}.tar.gz \
  && echo "$X265_SHA256  x265_${X265_VERSION}.tar.gz" | sha256sum --check \
  && tar xf x265_${X265_VERSION}.tar.gz \
  && cd x265_${X265_VERSION} \
  && cmake --install-prefix=$VIPS_PREFIX -G "Unix Makefiles" source \
  && make V=0 \
  && make install

# build libheif
ARG HEIF_VERSION=1.15.2
ARG HEIF_URL=https://github.com/strukturag/libheif/releases/download

RUN wget ${HEIF_URL}/v${HEIF_VERSION}/libheif-${HEIF_VERSION}.tar.gz \
  && tar xf libheif-${HEIF_VERSION}.tar.gz \
  && cd libheif-${HEIF_VERSION} \
  && ./configure --prefix=$VIPS_PREFIX \
  && make V=0 \
  && make install

# build libpdfium
ARG PDFIUM_VERSION=8044
ARG PDFIUM_SHA256=eb142f416aed3a72fc5a02dbd5884868a16cb99dc0cf53e6bdd64afbf67b05f4
ARG PDFIUM_URL=https://github.com/bblanchon/pdfium-binaries/releases/download/chromium

RUN wget $PDFIUM_URL/$PDFIUM_VERSION/pdfium-linux-x64.tgz \
  && echo "$PDFIUM_SHA256  pdfium-linux-x64.tgz" | sha256sum --check \
  && mkdir pdfium \
  && cd pdfium \
  && tar xf ../pdfium-linux-x64.tgz \
  && cp lib/* $VIPS_PREFIX/lib \
  && cp -r include/* $VIPS_PREFIX/include \
  && mkdir -p $VIPS_PREFIX/share/licenses/pdfium \
  && cp -r LICENSE licenses $VIPS_PREFIX/share/licenses/pdfium/

# make a pdfium.pc file libvips can use
RUN mkdir -p $VIPS_PREFIX/lib/pkgconfig \
  && cd $VIPS_PREFIX/lib/pkgconfig \
  && echo "prefix=$VIPS_PREFIX" >> pdfium.pc \
  && echo "exec_prefix=\${prefix}" >> pdfium.pc \
  && echo "libdir=\${exec_prefix}/lib" >> pdfium.pc \
  && echo "includedir=\${prefix}/include" >> pdfium.pc \
  && echo "Name: pdfium" >> pdfium.pc \
  && echo "Description: pdfium" >> pdfium.pc \
  && echo "Version: $PDFIUM_VERSION" >> pdfium.pc \
  && echo "Requires: " >> pdfium.pc \
  && echo "Libs: -L\${libdir} -lpdfium" >> pdfium.pc \
  && echo "Cflags: -I\${includedir}" >> pdfium.pc

# build libvips
ARG VIPS_VERSION=8.17.1
ARG VIPS_SHA256=4d8c3325922c5300253d7594507a8f1d3caf8eed70dfb66cc7eb2cbed65bb5ca
ARG VIPS_URL=https://github.com/libvips/libvips/releases/download

RUN wget ${VIPS_URL}/v${VIPS_VERSION}/vips-${VIPS_VERSION}.tar.xz \
  && echo "$VIPS_SHA256  vips-${VIPS_VERSION}.tar.xz" | sha256sum --check \
  && tar xf vips-${VIPS_VERSION}.tar.xz \
  && cd vips-${VIPS_VERSION} \
  && mkdir -p $VIPS_PREFIX/share/licenses/libvips \
  && cp LICENSE $VIPS_PREFIX/share/licenses/libvips/ \
  && meson setup build --prefix=${VIPS_PREFIX} --libdir=lib --buildtype=release \
       -Dpdfium=enabled -Dpoppler=disabled -Dmodules=disabled -Dintrospection=disabled -Dexamples=false \
  && cd build \
  && ninja \
  && ninja install

# clean the build area ready for packaging
RUN cd $VIPS_PREFIX \
  && find bin/* -maxdepth 1 -not -name 'vips*' -delete \
  && rm -f bin/vips-* lib/*.a lib/*.la \
  && strip lib/lib*.so*

# export build artifacts
ARG STACK_VERSION
RUN cd $VIPS_PREFIX \
  && rm -rf build \
  && mkdir build \
  && tar czf "build/heroku-${STACK_VERSION}.tar.gz" bin include lib share/licenses \
  && cd build \
  && sha256sum "heroku-${STACK_VERSION}.tar.gz" > "heroku-${STACK_VERSION}.tar.gz.sha256"

# export config logs
ARG STACK_VERSION
RUN cd $VIPS_PREFIX \
  && echo "$ vips --vips-version" > "build/heroku-${STACK_VERSION}.config.log" \
  && ./bin/vips --vips-version >> "build/heroku-${STACK_VERSION}.config.log" \
  && echo "" >> "build/heroku-${STACK_VERSION}.config.log" \
  && echo "$ vips --vips-config" >> "build/heroku-${STACK_VERSION}.config.log" \
  && ./bin/vips --vips-config >> "build/heroku-${STACK_VERSION}.config.log"
