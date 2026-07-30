import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'

const { darkAlgorithm } = theme

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: darkAlgorithm,
        token: {
          colorPrimary: '#00d4ff',
          colorInfo: '#00d4ff',
          colorBgBase: '#050810',
          colorBgContainer: '#0b1325',
          colorBgElevated: '#0f1a30',
          colorBorder: 'rgba(42, 66, 108, 0.35)',
          colorBorderSecondary: 'rgba(42, 66, 108, 0.2)',
          colorText: '#e8f0ff',
          colorTextSecondary: '#7889a3',
          colorTextTertiary: '#9aabc4',
          colorTextQuaternary: '#556080',
          borderRadius: 8,
          colorSuccess: '#4ade80',
          colorWarning: '#facc15',
          colorError: '#f87171',
        },
        components: {
          Button: { controlHeight: 36 },
          Input: { controlHeight: 36 },
          Select: { controlHeight: 36 },
          Table: {
            headerBg: '#0f1a30',
            headerColor: '#9aabc4',
            rowHoverBg: 'rgba(0, 212, 255, 0.06)',
            borderColor: 'rgba(42, 66, 108, 0.2)',
          },
          Modal: { contentBg: '#0b1325', headerBg: '#0b1325' },
          Tag: { defaultBg: 'rgba(0, 212, 255, 0.08)', defaultColor: '#00d4ff' },
          InputNumber: { controlHeight: 36 },
          Tabs: {
            inkBarColor: '#00d4ff',
            itemSelectedColor: '#00d4ff',
            itemHoverColor: '#7fe7ff',
            horizontalMargin: '0',
          },
          Tree: {
            nodeHoverBg: 'rgba(0, 212, 255, 0.06)',
            nodeSelectedBg: 'rgba(0, 212, 255, 0.14)',
            titleHeight: 28,
          },
          Slider: {
            railBg: 'rgba(42, 66, 108, 0.45)',
            trackBg: '#00d4ff',
            trackHoverBg: '#4f8cff',
            handleColor: '#00d4ff',
            handleActiveColor: '#00d4ff',
          },
          Pagination: { itemActiveBg: 'rgba(0, 212, 255, 0.12)' },
          Menu: {
            itemBg: '#0f1a30',
            itemHoverBg: 'rgba(0, 212, 255, 0.06)',
            itemSelectedBg: 'rgba(0, 212, 255, 0.12)',
            itemSelectedColor: '#00d4ff',
          },
          Card: { headerBg: 'transparent', headerFontSize: 15 },
          Statistic: { titleFontSize: 12, contentFontSize: 24 },
          Alert: {
            colorInfoBg: 'rgba(0, 212, 255, 0.08)',
            colorInfoBorder: 'rgba(0, 212, 255, 0.25)',
          },
          Popover: { colorBgElevated: '#0f1a30' },
        },
      }}
    >
      <AntApp>
        <HashRouter>
          <App />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
)
