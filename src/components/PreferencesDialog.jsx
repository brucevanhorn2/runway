import React, { useState, useCallback } from 'react';
import { Modal, Tabs, Form, InputNumber, Select, Switch, Button, Divider, Space } from 'antd';
import {
  SettingOutlined,
  CodeOutlined,
  ApartmentOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

const { TabPane } = Tabs;

const LAYOUT_OPTIONS = [
  { value: 'LR', label: 'Left to Right' },
  { value: 'TB', label: 'Top to Bottom' },
  { value: 'RL', label: 'Right to Left' },
  { value: 'BT', label: 'Bottom to Top' },
];

const WORD_WRAP_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
  { value: 'wordWrapColumn', label: 'At Column' },
  { value: 'bounded', label: 'Bounded' },
];

function PreferencesDialog({ open, onClose }) {
  const { preferences, updatePreferences, resetToDefaults, DEFAULT_PREFERENCES } = useUserPreferences();
  const [activeTab, setActiveTab] = useState('editor');

  // Editor preference handlers
  const handleEditorChange = useCallback((key, value) => {
    updatePreferences('editor', { [key]: value });
  }, [updatePreferences]);

  // Diagram preference handlers
  const handleDiagramChange = useCallback((key, value) => {
    updatePreferences('diagram', { [key]: value });
  }, [updatePreferences]);

  // General preference handlers
  const handleGeneralChange = useCallback((key, value) => {
    updatePreferences('general', { [key]: value });
  }, [updatePreferences]);

  // Reset handler
  const handleReset = useCallback(() => {
    Modal.confirm({
      title: 'Reset Preferences',
      content: 'Are you sure you want to reset all preferences to their default values?',
      okText: 'Reset',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        resetToDefaults();
      },
    });
  }, [resetToDefaults]);

  const formItemLayout = {
    labelCol: { span: 12 },
    wrapperCol: { span: 12 },
  };

  return (
    <Modal
      title={
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          Preferences
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button icon={<UndoOutlined />} onClick={handleReset}>
            Reset to Defaults
          </Button>
          <Button type="primary" onClick={onClose}>
            Done
          </Button>
        </Space>
      }
      width={520}
      styles={{
        body: { padding: '12px 0' },
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabPosition="left"
        style={{ minHeight: 360 }}
      >
        {/* Editor Settings */}
        <TabPane
          tab={
            <span>
              <CodeOutlined />
              Editor
            </span>
          }
          key="editor"
        >
          <Form {...formItemLayout} colon={false} style={{ padding: '0 16px' }}>
            <Form.Item label="Font Size">
              <InputNumber
                min={10}
                max={24}
                value={preferences.editor.fontSize}
                onChange={(value) => handleEditorChange('fontSize', value)}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Tab Size">
              <InputNumber
                min={1}
                max={8}
                value={preferences.editor.tabSize}
                onChange={(value) => handleEditorChange('tabSize', value)}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Word Wrap">
              <Select
                value={preferences.editor.wordWrap}
                onChange={(value) => handleEditorChange('wordWrap', value)}
                options={WORD_WRAP_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Show Minimap">
              <Switch
                checked={preferences.editor.showMinimap}
                onChange={(checked) => handleEditorChange('showMinimap', checked)}
              />
            </Form.Item>

            <Form.Item label="Format on Save">
              <Switch
                checked={preferences.editor.formatOnSave}
                onChange={(checked) => handleEditorChange('formatOnSave', checked)}
              />
            </Form.Item>
          </Form>
        </TabPane>

        {/* Diagram Settings */}
        <TabPane
          tab={
            <span>
              <ApartmentOutlined />
              Diagram
            </span>
          }
          key="diagram"
        >
          <Form {...formItemLayout} colon={false} style={{ padding: '0 16px' }}>
            <Form.Item label="Default Layout">
              <Select
                value={preferences.diagram.defaultLayout}
                onChange={(value) => handleDiagramChange('defaultLayout', value)}
                options={LAYOUT_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item label="Show Minimap">
              <Switch
                checked={preferences.diagram.showMinimap}
                onChange={(checked) => handleDiagramChange('showMinimap', checked)}
              />
            </Form.Item>

            <Form.Item label="Show Edge Labels">
              <Switch
                checked={preferences.diagram.showEdgeLabels}
                onChange={(checked) => handleDiagramChange('showEdgeLabels', checked)}
              />
            </Form.Item>

            <Form.Item label="Animate Edges">
              <Switch
                checked={preferences.diagram.animateEdges}
                onChange={(checked) => handleDiagramChange('animateEdges', checked)}
              />
            </Form.Item>
          </Form>
        </TabPane>

        {/* General Settings */}
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              General
            </span>
          }
          key="general"
        >
          <Form {...formItemLayout} colon={false} style={{ padding: '0 16px' }}>
            <Form.Item label="Auto-open Last Folder">
              <Switch
                checked={preferences.general.autoOpenLastFolder}
                onChange={(checked) => handleGeneralChange('autoOpenLastFolder', checked)}
              />
            </Form.Item>

            <Form.Item label="Confirm Before Close">
              <Switch
                checked={preferences.general.confirmBeforeClose}
                onChange={(checked) => handleGeneralChange('confirmBeforeClose', checked)}
              />
            </Form.Item>
          </Form>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ padding: '0 16px', color: '#888', fontSize: 12 }}>
            <p>Preferences are stored in your user data directory and apply to all projects.</p>
          </div>
        </TabPane>
      </Tabs>
    </Modal>
  );
}

export default PreferencesDialog;
