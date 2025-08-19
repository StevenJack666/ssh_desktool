// import path from "path";

// export function isDevFn(mode: string): boolean {
//   return mode === "development";
// }

// export function isProdFn(mode: string): boolean {
//   return mode === "production";
// }

// export function isTestFn(mode: string): boolean {
//   return mode === "test";
// }

// /**
//  * Whether to generate package preview
//  * 是否生成包预览
//  */
// export function isReportMode(): boolean {
//   return process.env.VITE_REPORT === "true";
// }

// // Read all environment variable configuration files to process.env 读取所有环境变量配置文件到process.env
// export function wrapperEnv(envConf: Recordable): ViteEnv {
//   const ret: any = {};

//   for (const envName of Object.keys(envConf)) {
//     let realName = envConf[envName].replace(/\\n/g, "\n");
//     realName = realName === "true" ? true : realName === "false" ? false : realName;
//     // 端口号
//     if (envName === "VITE_PORT") realName = Number(realName);
//     // 代理
//     if (envName === "VITE_PROXY") {
//       try {
//         realName = JSON.parse(realName);
//       } catch (error) {}
//     }
//     ret[envName] = realName;
//   }
//   return ret;
// }

// // ret数据   拆分键值对 将所有env内容结构成可用数据
// /* {                                                                                                                                                                                                                 10:38:25
//   VITE_GLOB_APP_TITLE: 'xxxxx',
//   VITE_PORT: 9090,
//   VITE_OPEN: false,
//   VITE_REPORT: true,
//   VITE_USER_NODE_ENV: 'development',
//   VITE_PUBLIC_PATH: '/',
//   VITE_ROUTER_MODE: 'hash',
//   VITE_DROP_CONSOLE: true,
//   VITE_PWA: false,
//   VITE_API_URL: '/api',
//   VITE_PROXY: [
//     [
//       '/api',
//       'https://xxxx/xxxxx'
//     ]
//   ]
// }
//  */

// /**
//  * Get user root directory
//  * @param dir file path
//  */
// export function getRootPath(...dir: string[]) {
//   return path.resolve(process.cwd(), ...dir);
// } 