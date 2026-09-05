'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import SendIcon from '@mui/icons-material/Send';
import { useSnackbar } from 'notistack';
import { FormDialog, StatusBadge } from '@/components/ui';
import type { PrmRequestTableItem } from './PrmRequestTableView';
import { buildDeliveryPayload, getDeliveryProgress, getRemainingQuantity, validateDeliveryDialog, type DeliveryDialogItem } from './prm-delivery-submit';

interface PrmDeliveryDialogProps {
  open: boolean;
  request: PrmRequestTableItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function createDeliveryItems(request: PrmRequestTableItem): DeliveryDialogItem[] {
  return request.items.map((item) => ({
    requestItemId: item.id,
    nomenclatureId: item.nomenclatureId,
    name: item.nomenclature.name,
    unit: item.nomenclature.unit,
    requestedQty: Number(item.requestedQty),
    previouslyReceivedQty: Number(item.receivedQty),
    receivedQty: 0,
    actualPrice: null,
  }));
}

export function PrmDeliveryDialog({ open, request, onClose, onSuccess }: PrmDeliveryDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<DeliveryDialogItem[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [document, setDocument] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef('');

  useEffect(() => {
    if (open && request) {
      setItems(createDeliveryItems(request));
      setSupplierName(request.supplierName || '');
      setDocument('');
      idempotencyKeyRef.current = `${request.id}-${crypto.randomUUID()}`;
    }
  }, [open, request]);

  if (!request) return null;

  const idempotencyKey = idempotencyKeyRef.current;
  const updateQuantity = (index: number, value: string) => {
    const nextValue = Number(value);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, receivedQty: Number.isFinite(nextValue) ? nextValue : 0 } : item));
  };

  const handleSubmit = async () => {
    const validationError = validateDeliveryDialog({ idempotencyKey, supplierName, document, items });
    if (validationError) {
      enqueueSnackbar(validationError, { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/prm/requests/${request.id}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDeliveryPayload({ idempotencyKey, supplierName, document, items })),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        enqueueSnackbar(body.error || 'Ошибка регистрации поставки', { variant: 'error' });
        return;
      }
      enqueueSnackbar('Поставка зарегистрирована и зачислена на склад', { variant: 'success' });
      onSuccess();
      onClose();
    } catch {
      enqueueSnackbar('Ошибка сети при регистрации поставки', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog open={open} onClose={() => !submitting && onClose()} title={`Приёмка по заявке ${request.requestNumber}`} subtitle="Частичная поставка допускается; остаток будет доступен для следующей приёмки" icon={<MoveToInboxOutlinedIcon color="primary" />} maxWidth="lg" loading={submitting} submitLabel="Зарегистрировать приёмку" submitIcon={<SendIcon />} onSubmit={handleSubmit} submitDisabled={submitting}>
      <Stack spacing={2.5}>
        <Alert severity="info">Каждая регистрация создаёт отдельный приход на целевом складе. Приёмка сверх заказанного остатка запрещена.</Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField size="small" label="Поставщик" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
          <TextField size="small" label="Документ-основание" value={document} onChange={(event) => setDocument(event.target.value)} placeholder="Накладная, УПД, акт" />
        </Box>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Позиция</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Заказано</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Получено ранее</TableCell>
                <TableCell sx={{ minWidth: 150, fontWeight: 700 }}>Принять сейчас</TableCell>
                <TableCell sx={{ minWidth: 180, fontWeight: 700 }}>Прогресс</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => {
                const remaining = getRemainingQuantity(item);
                const progress = getDeliveryProgress({ requestedQty: item.requestedQty, receivedQty: item.previouslyReceivedQty + item.receivedQty });
                return (
                  <TableRow key={item.requestItemId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.unit}</Typography>
                    </TableCell>
                    <TableCell align="right">{item.requestedQty} {item.unit}</TableCell>
                    <TableCell align="right">{item.previouslyReceivedQty} {item.unit}</TableCell>
                    <TableCell>
                      <TextField type="number" size="small" fullWidth value={item.receivedQty || ''} onChange={(event) => updateQuantity(index, event.target.value)} inputProps={{ min: 0, max: remaining, step: 'any' }} helperText={`Осталось: ${remaining} ${item.unit}`} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 7, borderRadius: 4 }} />
                        <StatusBadge status={progress >= 100 ? 'DELIVERED' : progress > 0 ? 'PARTIALLY_DELIVERED' : 'DRAFT'} showIcon={false} />
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>

        <Typography variant="caption" color="text.secondary">Поля «Получено ранее» и прогресс обновятся после успешной регистрации поставки.</Typography>
      </Stack>
    </FormDialog>
  );
}

export default PrmDeliveryDialog;
