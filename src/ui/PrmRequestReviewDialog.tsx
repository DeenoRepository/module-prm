'use client';

import React from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Paper, Divider, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { StatusBadge, FormDialog } from '@/components/ui';

export type PrmReviewDecision = 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface PrmRequestForReview {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  estimatedTotal: number | string;
  currency: string;
  justification: string | null;
  supplierName: string | null;
  targetWarehouse: { name: string };
  requester: { displayName: string };
  items: Array<{ id: string; requestedQty: number | string; estimatedPrice: number | string; nomenclature: { name: string; unit: string } }>;
}

interface PrmRequestReviewDialogProps {
  open: boolean;
  request: PrmRequestForReview | null;
  resolutionComment: string;
  submitting: boolean;
  onClose: () => void;
  onCommentChange: (comment: string) => void;
  onProcessReview: (decision: PrmReviewDecision) => void;
}

export function PrmRequestReviewDialog({
  open,
  request,
  resolutionComment,
  submitting,
  onClose,
  onCommentChange,
  onProcessReview,
}: PrmRequestReviewDialogProps) {
  if (!request) return null;

  return (
    <FormDialog
      open={open}
      onClose={() => !submitting && onClose()}
      title="Рассмотрение заявки на закупку ТМЦ"
      icon={<CheckCircleOutlineIcon color="primary" />}
      maxWidth="sm"
      hideActions
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: 'background.default' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
              {request.requestNumber}
            </Typography>
            <StatusBadge status={request.priority} size="small" />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="caption" color="text.secondary" display="block">
            Склад назначения:
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {request.targetWarehouse.name}
          </Typography>

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Инициатор:
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {request.requester.displayName}
          </Typography>

          {request.supplierName && (
            <>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Предполагаемый поставщик:
              </Typography>
              <Typography variant="body2">{request.supplierName}</Typography>
            </>
          )}

          {request.justification && (
            <>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Обоснование:
              </Typography>
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                «{request.justification}»
              </Typography>
            </>
          )}

          <Box sx={{ mt: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Позиция</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                    Кол-во
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                    Цена
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {request.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{item.nomenclature.name}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                      {item.requestedQty} {item.nomenclature.unit}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                      {Number(item.estimatedPrice).toLocaleString('ru-RU')} ₽
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Divider sx={{ my: 1.5 }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Итого: {Number(request.estimatedTotal).toLocaleString('ru-RU')} {request.currency}
          </Typography>
        </Paper>

        <TextField
          fullWidth
          multiline
          minRows={3}
          size="small"
          label="Комментарий / Резолюция согласующего"
          placeholder="Обязательно укажите причину в случае отклонения..."
          value={resolutionComment}
          onChange={(e) => onCommentChange(e.target.value)}
          disabled={submitting}
        />

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', mt: 1 }}>
          <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none' }}>
            Отмена
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelOutlinedIcon />}
            onClick={() => onProcessReview('REJECTED')}
            disabled={submitting}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {submitting ? <CircularProgress size={18} /> : 'Отклонить'}
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => onProcessReview('APPROVED')}
            disabled={submitting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Согласовать'}
          </Button>
        </Box>
      </Box>
    </FormDialog>
  );
}

export default PrmRequestReviewDialog;
