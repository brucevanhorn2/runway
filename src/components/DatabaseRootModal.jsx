import React, { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const COLOR_PALETTE = [
  { value: '#4a9eff', label: 'Sky Blue' },
  { value: '#4caf87', label: 'Emerald' },
  { value: '#f0a030', label: 'Amber' },
  { value: '#c875e8', label: 'Orchid' },
  { value: '#f06060', label: 'Coral' },
  { value: '#26c6ca', label: 'Teal' },
  { value: '#ff8a65', label: 'Peach' },
  { value: '#78909c', label: 'Slate' },
];

function ColorSwatchPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {COLOR_PALETTE.map(color => {
        const isSelected = value === color.value;
        return (
          <div
            key={color.value}
            title={color.label}
            onClick={() => onChange(color.value)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: color.value,
              cursor: 'pointer',
              border: isSelected ? '2px solid #fff' : '2px solid transparent',
              boxShadow: isSelected ? `0 0 0 2px ${color.value}, 0 0 6px ${color.value}` : 'none',
              transition: 'box-shadow 0.15s, border 0.15s',
            }}
          />
        );
      })}
    </div>
  );
}

function DatabaseRootModal({ open, mode, initialValues, folderName, onConfirm, onCancel }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.setFieldsValue({
          name: folderName || '',
          color: '#4a9eff',
          description: '',
        });
      }
    }
  }, [open, initialValues, folderName, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onConfirm(values);
    } catch {
      // validation errors shown inline
    }
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DatabaseOutlined />
          {mode === 'create' ? 'Mark as Database Root' : 'Edit Database Info'}
        </span>
      }
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={mode === 'create' ? 'Create' : 'Save'}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        initialValues={{ color: '#4a9eff' }}
      >
        <Form.Item
          name="name"
          label="Database Name"
          rules={[{ required: true, message: 'Please enter a database name' }]}
        >
          <Input placeholder="e.g. Users DB" autoFocus />
        </Form.Item>

        <Form.Item name="color" label="Color">
          <ColorSwatchPicker />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea
            rows={2}
            placeholder="Optional description"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default DatabaseRootModal;
