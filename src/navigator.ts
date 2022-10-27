// interface INavigator extends globalThis.Navigator {
//   mediaSession: {
//     metadata: IMediaMetadata;
//     setActionHandler(event: "nexttrack", callback: () => void): void;
//     setActionHandler(event: string, callback: () => void): void;
//   };
// }

// export declare class IMediaMetadata {
//   constructor(object: {
//     title: string;
//     artist: string;
//     album: string;
//     artwork: { src: string, sizes: string, type: string }[];
//   });
// }

// export default globalThis.navigator as INavigator;
// export const MediaMetadata = (globalThis as any).MediaMetadata as typeof IMediaMetadata;