import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'
import './management/DashboardManagement.css'

const { defaultAlgorithm } = theme
document.documentElement.dataset.theme = 'light'

// Apple HIG 风格系统令牌：浅色优先，浅灰分层 + 系统蓝
const appleTheme = {
  algorithm: defaultAlgorithm,
  token: {
    colorPrimary: '#0071e3',
    colorInfo: '#0071e3',
    colorLink: '#0071e3',
    colorBgBase: '#f5f5f7',
    colorBgLayout: '#f5f5f7',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBorder: 'rgba(0, 0, 0, 0.10)',
    colorBorderSecondary: 'rgba(0, 0, 0, 0.06)',
    colorText: '#1d1d1f',
    colorTextSecondary: '#6e6e73',
    colorTextTertiary: '#86868b',
    colorTextQuaternary: '#aeaeb2',
    colorSuccess: '#34c759',
    colorWarning: '#ff9500',
    colorError: '#ff3b30',
    borderRadius: 10,
    fontSize: 14,
    controlHeight: 34,
    controlHeightSM: 28,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: { controlHeight: 34, controlHeightSM: 28, fontWeight: 500 },
    Input: { controlHeight: 34 },
    InputNumber: { controlHeight: 34 },
    Select: { controlHeight: 34 },
    Table: {
      headerBg: '#f5f5f7',
      headerColor: '#6e6e73',
      rowHoverBg: 'rgba(0, 0, 0, 0.03)',
      borderColor: 'rgba(0, 0, 0, 0.06)',
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
    },
    Modal: { contentBg: '#ffffff', headerBg: '#ffffff' },
    Card: { headerBg: 'transparent', headerFontSize: 15 },
    Tag: { defaultBg: '#f2f2f7', defaultColor: '#3a3a3c' },
    Tabs: {
      inkBarColor: '#0071e3',
      itemSelectedColor: '#0071e3',
      itemHoverColor: '#0a84ff',
      horizontalMargin: '0',
    },
    Tree: {
      nodeHoverBg: 'rgba(0, 0, 0, 0.04)',
      nodeSelectedBg: 'rgba(0, 113, 227, 0.12)',
      titleHeight: 26,
    },
    Slider: {
      railBg: 'rgba(0, 0, 0, 0.12)',
      trackBg: '#0071e3',
      trackHoverBg: '#0a84ff',
      handleColor: '#0071e3',
      handleActiveColor: '#0071e3',
    },
    Pagination: { itemActiveBg: 'rgba(0, 113, 227, 0.12)' },
    Menu: {
      itemBg: '#ffffff',
      itemHoverBg: 'rgba(0, 0, 0, 0.04)',
      itemSelectedBg: 'rgba(0, 113, 227, 0.12)',
      itemSelectedColor: '#0071e3',
      itemHeight: 34,
      itemMarginInline: 6,
    },
    Statistic: { titleFontSize: 12, contentFontSize: 24 },
    Alert: {
      colorInfoBg: 'rgba(0, 113, 227, 0.06)',
      colorInfoBorder: 'rgba(0, 113, 227, 0.18)',
    },
    Popover: { colorBgElevated: '#ffffff' },
  },
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntApp>
        <HashRouter>
          <App />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
)
