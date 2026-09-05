'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography, Box, Button } from '@mui/material';
import { StatusBadge } from '@/components/ui';
import { formatDateTime } from '@ems/shared';

export interface PrmRequestTableItem {
  id: string;
  requestNumber: string;
  status: string;
  priority: string;
  estimatedTotal: number | string;
  currency: string;
  createdAt: string;
  justification: string | null;
  supplierName: string | null;
  targetWarehouse: { id: string; name: string; code: string; responsibleUserId?: string };
  requester: { id: string; displayName: string };
  reviewer: { id: string; displayName: string } | null;
  closedAt?: string | null;
  closedBy?: { id: string; displayName: string } | null;
  equipmentId?: string | null;
  equipment?: { id: string; name: string; inventoryNumber?: string | null } | null;
  maintenanceScheduleId?: string | null;
  maintenanceSchedule?: { id: string; title: string } | null;
  items: Array<{
    id: string;
    nomenclatureId: string;
    requestedQty: number | string;
    receivedQty: number | string;
    estimatedPrice: number | string;
    nomenclature: { name: string; unit: string };
  }>;
}

interface PrmRequestTableViewProps {
  items: PrmRequestTableItem[];
  currentUserId?: string;
  canReview: boolean;
  canClose: (item: PrmRequestTableItem) => boolean;
  onSelectDetails: (item: PrmRequestTableItem) => void;
  onSubmit: (item: PrmRequestTableItem) => void;
  onReview: (item: PrmRequestTableItem) => void;
  onCancel: (item: PrmRequestTableItem) => void;
  onCloseRequest: (item: PrmRequestTableItem) => void;
}

export function PrmRequestTableView({
  items,
  currentUserId,
  canReview,
  canClose,
  onSelectDetails,
  onSubmit,
  onReview,
  onCancel,
  onCloseRequest,
}: PrmRequestTableViewProps) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: 'background.default' }}>
          <TableCell sx={{ minWidth: 140 }}>№ заявки</TableCell>
          <TableCell sx={{ minWidth: 180 }}>Склад назначения</TableCell>
          <TableCell sx={{ minWidth: 200 }}>Позиции</TableCell>
          <TableCell sx={{ minWidth: 110 }}>Приоритет</TableCell>
          <TableCell sx={{ minWidth: 130 }}>Статус</TableCell>
          <TableCell sx={{ minWidth: 140 }}>Инициатор</TableCell>
          <TableCell align="right" sx={{ minWidth: 120 }}>
            Сумма
          </TableCell>
          <TableCell sx={{ minWidth: 130 }}>Дата</TableCell>
          <TableCell align="right" sx={{ minWidth: 140 }}>
            Действия
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((req) => {
          const isRequester = currentUserId === req.requester.id;
          const isDraft = req.status === 'DRAFT';
          const isSubmitted = req.status === 'SUBMITTED';
          const isDelivered = req.status === 'DELIVERED';

          return (
            <TableRow key={req.id} hover sx={{ cursor: 'pointer' }} onClick={() => onSelectDetails(req)}>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                  {req.requestNumber}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: '0.8125rem' }}>{req.targetWarehouse.name}</TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                {req.items.slice(0, 2).map((it) => it.nomenclature.name).join(', ')}
                {req.items.length > 2 ? ` +${req.items.length - 2}` : ''}
              </TableCell>
              <TableCell>
                <StatusBadge status={req.priority} size="small" />
              </TableCell>
              <TableCell>
                <StatusBadge status={req.status} />
              </TableCell>
              <TableCell sx={{ fontSize: '0.8125rem' }}>{req.requester.displayName}</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                {Number(req.estimatedTotal).toLocaleString('ru-RU')} {req.currency}
              </TableCell>
              <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontFamily: 'monospace' }}>
                {formatDateTime(req.createdAt)}
              </TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                  {isDraft && isRequester && (
                    <Button size="small" variant="contained" onClick={() => onSubmit(req)} sx={{ fontSize: '0.75rem', px: 1.25, borderRadius: '6px' }}>
                      Подать
                    </Button>
                  )}
                  {isSubmitted && canReview && (
                    <Button size="small" variant="contained" color="primary" onClick={() => onReview(req)} sx={{ fontSize: '0.75rem', px: 1.25, borderRadius: '6px' }}>
                      Решение
                    </Button>
                  )}
                  {(isDraft || isSubmitted) && (isRequester || canReview) && (
                    <Button size="small" variant="outlined" color="inherit" onClick={() => onCancel(req)} sx={{ fontSize: '0.75rem', px: 1, borderRadius: '6px' }}>
                      Отменить
                    </Button>
                  )}
                  {isDelivered && canClose(req) && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCloseRequest(req);
                      }}
                      sx={{ fontSize: '0.75rem', px: 1.25, borderRadius: '6px' }}
                    >
                      Закрыть
                    </Button>
                  )}
                </Box>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default PrmRequestTableView;
