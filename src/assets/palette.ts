// Visual tokens — see docs/ART_BIBLE.md. Every colour in the world should come from here.
export const P = {
  pink: 0xffccd5,
  pinkSoft: 0xffe3ea,
  pinkDeep: 0xff9db3,
  blue: 0xb2d9ff,
  blueSoft: 0xdcecff,
  blueDeep: 0x86b8f0,
  cream: 0xfff6e8,
  white: 0xffffff,
  lavender: 0xe9ddff,
  lavenderDeep: 0xcdb8f5,
  purple: 0xe6b2ff,
  butter: 0xffe9a8,
  butterDeep: 0xf8d57e,
  mint: 0xbff0da,
  mintDeep: 0x8fdcbc,
  strawberry: 0xff7a93,
  strawberryDeep: 0xe85a78,
  peach: 0xffdcc8,
  peachDeep: 0xffbe9c,
  wood: 0xf6ddb8,
  woodDeep: 0xebc9a0,
  metal: 0xd9ddf0,
  ink: 0x364049,
  inkSoft: 0x8a99a8,
  grass: 0xc8efb8,
  grassDeep: 0xa6e0a0,
  sand: 0xffeccb,
  sea: 0x9fd8f2,
  seaDeep: 0x7cc3ea,
  skin: 0xffe7da,
  blush: 0xffb3c1,
  hair: 0x2b2a33,
  hairSheen: 0x646b8a,
  chalk: 0x8fc9b0,
};

export const CSS = {
  ink: '#364049',
  inkSoft: '#8A99A8',
  pink: '#FFCCD5',
  blue: '#B2D9FF',
  purple: '#E6B2FF',
  strawberry: '#FF7A93',
  cream: '#FFF6E8',
};

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
