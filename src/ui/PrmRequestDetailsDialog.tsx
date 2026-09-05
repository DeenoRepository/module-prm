'use client';

import React from 'react';
import Link from 'next/link';
import { Box, Divider, LinearProgress, Paper, Typography, Table, TableBody, TableCell, TableHead, TableRow, Button } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { FormDialog, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@ems/shared';
import type { PrmRequestTableItem } from './PrmRequestTableView';

interface PrmRequestDetailsDialogProps {
  open: boolean;
  request: PrmRequestTableItem | null;
  currentUserId?: string;
  canReview: boolean;
  canClose: boolean;
  canViewEps?: boolean;
  canViewMro?: boolean;
  onClose: () => void;
  onReceive: (request: PrmRequestTableItem) => void;
  onSubmit: (request: PrmRequestTableItem) => void;
  onReview: (request: PrmRequestTableItem) => void;
  onCancel: (request: PrmRequestTableItem) => void;
  onCloseRequest: (request: PrmRequestTableItem) => void;
}

export function PrmRequestDetailsDialog({
  open,
  request,
  currentUserId,
  canReview,
  canClose,
  canViewEps = true,
  canViewMro = true,
  onClose,
  onReceive,
  onSubmit,
  onReview,
  onCancel,
  onCloseRequest,
}: PrmRequestDetailsDialogProps) {
  if (!request) return null;

  const isRequester = request.requester.id === currentUserId;
  const isDraft = request.status === 'DRAFT';
  const isSubmitted = request.status === 'SUBMITTED';
  const isReceivable = ['APPROVED', 'IN_PROGRESS', 'PARTIALLY_DELIVERED'].includes(request.status);
  const isDelivered = request.status === 'DELIVERED';

  return (
    <FormDialog open={open} onClose={onClose} title={`Заявка ${request.requestNumber}`} subtitle="Детали заявки на закупку ТМЦ" maxWidth="md" hideActions>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusBadge status={request.status} />
            <StatusBadge status={request.priority} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            Создана: {formatDateTime(request.createdAt)}
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Склад назначения</Typography>
              <Typography variant="body2" fontWeight={700}>{request.targetWarehouse.name} ({request.targetWarehouse.code})</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Инициатор</Typography>
              <Typography variant="body2" fontWeight={600}>{request.requester.displayName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Поставщик</Typography>
              <Typography variant="body2">{request.supplierName || 'Не указан'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">Согласующий</Typography>
              <Typography variant="body2">{request.reviewer?.displayName || 'Не назначен'}</Typography>
            </Box>
          </Box>
          {request.closedAt && request.closedBy && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" display="block">Закрыта</Typography>
              <Typography variant="body2" fontWeight={600}>
                {request.closedBy.displayName}, {formatDateTime(request.closedAt)}
              </Typography>
            </>
          )}
          {request.justification && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" display="block">Обоснование</Typography>
              <Typography variant="body2">{request.justification}</Typography>
            </>
          )}
          {(request.equipment || request.maintenanceSchedule) && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 700 }}>
                Связанные объекты
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                {request.equipment && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">Оборудование (EPS)</Typography>
                    {canViewEps ? (
                      <Button
                        component={Link}
                        href={`/eps/${request.equipment.id}`}
                        size="small"
                        sx={{ p: 0, textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left', fontWeight: 600 }}
                        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      >
                        {request.equipment.name}
                        {request.equipment.inventoryNumber ? ` (${request.equipment.inventoryNumber})` : ''}
                      </Button>
                    ) : (
                      <Typography variant="body2" fontWeight={600}>
                        {request.equipment.name}
                        {request.equipment.inventoryNumber ? ` (${request.equipment.inventoryNumber})` : ''}
                      </Typography>
                    )}
                  </Box>
                )}
                {request.maintenanceSchedule && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">График ТО (MRO)</Typography>
                    {canViewMro ? (
                      <Button
                        component={Link}
                        href={`/mro?scheduleId=${encodeURIComponent(request.maintenanceSchedule.id)}`}
                        size="small"
                        sx={{ p: 0, textTransform: 'none', justifyContent: 'flex-start', textAlign: 'left', fontWeight: 600 }}
                        endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                      >
                        {request.maintenanceSchedule.title}
                      </Button>
                    ) : (
                      <Typography variant="body2" fontWeight={600}>
                        {request.maintenanceSchedule.title}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Номенклатура</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Количество</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Цена</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Сумма</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {request.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{item.nomenclature.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.nomenclature.unit}</Typography>
                  </TableCell>
                  <TableCell align="right">{Number(item.requestedQty).toLocaleString('ru-RU')}</TableCell>
                  <TableCell align="right">{Number(item.estimatedPrice).toLocaleString('ru-RU')} {request.currency}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {(Number(item.requestedQty) * Number(item.estimatedPrice)).toLocaleString('ru-RU')} {request.currency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Итого: {Number(request.estimatedTotal).toLocaleString('ru-RU')} {request.currency}
            </Typography>
          </Box>
        </Paper>

        {request.status !== 'DRAFT' && request.status !== 'SUBMITTED' && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Прогресс поставки</Typography>
              <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                {request.items.length > 0
                  ? Math.round(request.items.reduce((sum, item) => sum + Math.min(100, (Number(item.receivedQty) / Number(item.requestedQty)) * 100), 0) / request.items.length)
                  : 0}%
              </Typography>
            </Box>
            {request.items.map((item) => {
              const requested = Number(item.requestedQty);
              const received = Number(item.receivedQty);
              const progress = requested > 0 ? Math.min(100, (received / requested) * 100) : 0;
              return (
                <Box key={item.id} sx={{ mb: 1.25 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.35 }}>
                    <Typography variant="caption" color="text.secondary">{item.nomenclature.name}</Typography>
                    <Typography variant="caption" fontWeight={600}>{received} / {requested} {item.nomenclature.unit}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              );
            })}
          </Paper>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
          {isReceivable && (
            <Button variant="contained" color="success" onClick={() => onReceive(request)}>Принять поставку</Button>
          )}
          {isDraft && isRequester && (
            <Button variant="contained" onClick={() => onSubmit(request)}>Подать на согласование</Button>
          )}
          {isSubmitted && canReview && (
            <Button variant="contained" color="primary" onClick={() => onReview(request)}>Принять решение</Button>
          )}
          {(isDraft || isSubmitted) && (isRequester || canReview) && (
            <Button variant="outlined" color="inherit" onClick={() => onCancel(request)}>Отменить</Button>
          )}
          {isDelivered && canClose && (
            <Button variant="contained" color="success" onClick={() => onCloseRequest(request)}>Закрыть заявку</Button>
          )}
          <Button variant="text" endIcon={<OpenInNewIcon />} onClick={onClose}>Закрыть</Button>
        </Box>
      </Box>
    </FormDialog>
  );
}

export default PrmRequestDetailsDialog;
