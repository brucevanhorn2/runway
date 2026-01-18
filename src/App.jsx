import React from 'react';
import { ConfigProvider } from 'antd';
import Layout from './Layout';
import 'antd/dist/reset.css';
import './App.css';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorBgBase: '#1e1e1e',
          colorTextBase: '#d4d4d4',
        },
      }}
    >
      <Layout />
    </ConfigProvider>
  );
}

export default App;
