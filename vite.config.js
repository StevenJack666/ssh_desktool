import { defineConfig } from 'vite'
// import { defineConfig, loadEnv, ConfigEnv, UserConfig } from "vite";
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        electron([
          {
            entry: 'src-electron/main.js',
            onstart(options) {
              options.startup()
            },
            vite: {
              build: {
                outDir: 'dist-electron/main',
                rollupOptions: {
                  external: ['electron', 'ssh2', 'better-sqlite3']
                }
              }
            }
          },
          {
            entry: 'src-electron/preload.js',
            onstart(options) {
              options.reload()
            },
            vite: {
              build: {
                outDir: 'dist-electron/preload',
                rollupOptions: {
                  external: ['electron']
                }
              }
            }
          }
        ])
    ],

    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'esbuild',
      rollupOptions: {
        input: {
          main: 'index.html',
          session: 'session.html'
        }
      }
    },

    // css: {
    //   preprocessorOptions: {
    //     scss: {
    //       additionalData: `@import "@/styles/variables.scss";`,
    //     },
    //   },
    // },
    resolve: {
      alias: {
      '@': '/src',
      },
    },
    /*开发服务器选项*/
    server: {
      port: 5173,
      strictPort: true, // 如果端口被占用则直接失败，不尝试其他端口
      open: false,
    },
})
