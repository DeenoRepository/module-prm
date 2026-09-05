'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  TextField,
  MenuItem,
  Stack,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useSnackbar } from 'notistack';
import { FormDialog } from '@/components/ui';
import { PERMISSIONS, PURCHASE_REQUEST_PRIORITY_MAP } from '@ems/shared';
import { useAuth } from '@/lib/auth-client';
import {
  addOrMergeLineItem,
  buildPurchaseRequestPayload,
  calculateEstimatedTotal,
  validatePurchaseRequest,
  type PrmRequestLineItem,
} from './prm-wizard-submit';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface NomenclatureOption {
  id: string;
  name: string;
  article?: string | null;
  unit: string;
}

interface EquipmentOption {
  id: string;
  name: string;
  inventoryNumber?: string | null;
}

interface MaintenanceScheduleOption {
  id: string;
  title: string;
  equipmentId: string;
}

export interface PrmRequestWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEquipmentId?: string | null;
  initialMaintenanceScheduleId?: string | null;
}

export default function PrmRequestWizardDialog({
  open,
  onClose,
  onSuccess,
  initialEquipmentId,
  initialMaintenanceScheduleId,
}: PrmRequestWizardDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canViewEps = hasPermission(PERMISSIONS.EPS_EQUIPMENT_VIEW);
  const canViewMro = hasPermission(PERMISSIONS.MRO_SCHEDULE_VIEW);

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [justification, setJustification] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([]);
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId || '');
  const [schedules, setSchedules] = useState<MaintenanceScheduleOption[]>([]);
  const [maintenanceScheduleId, setMaintenanceScheduleId] = useState(initialMaintenanceScheduleId || '');

  const [nomenclatures, setNomenclatures] = useState<NomenclatureOption[]>([]);
  const [lineItems, setLineItems] = useState<PrmRequestLineItem[]>([]);
  const [selectedNomenclature, setSelectedNomenclature] = useState<NomenclatureOption | null>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingShortage, setLoadingShortage] = useState(false);
  const deliveryKeyRef = useRef('');

  useEffect(() => {
    if (open) {
      setTargetWarehouseId('');
      setPriority('MEDIUM');
      setJustification('');
      setSupplierName('');
      setEquipmentId(initialEquipmentId || '');
      setMaintenanceScheduleId(initialMaintenanceScheduleId || '');
      setLineItems([]);
      setSelectedNomenclature(null);
      setItemQty('1');
      setItemPrice('0');
      deliveryKeyRef.current = '';

      fetch('/api/wms/warehouses')
        .then((r) => r.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setWarehouses(json.data);
          }
        })
        .catch(() => {
          enqueueSnackbar('Не удалось загрузить список складов', { variant: 'error' });
        });

      fetch('/api/wms/nomenclature?limit=500')
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setNomenclatures(json.data.items || json.data || []);
          }
        })
        .catch(() => {
          enqueueSnackbar('Не удалось загрузить номенклатуру ТМЦ', { variant: 'error' });
        });

      if (canViewEps) {
        fetch('/api/eps/equipment?pageSize=500')
          .then((r) => r.json())
          .then((json) => {
            if (json.success && json.data) {
              setEquipmentList(json.data.items || json.data || []);
            }
          })
          .catch(() => {
            // non-critical
          });
      } else {
        setEquipmentList([]);
      }
    }
  }, [open, initialEquipmentId, initialMaintenanceScheduleId, canViewEps, enqueueSnackbar]);

  useEffect(() => {
    if (!canViewMro || !equipmentId) {
      setSchedules([]);
      setMaintenanceScheduleId('');
      return;
    }

    fetch(`/api/mro/schedules?equipmentId=${encodeURIComponent(equipmentId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setSchedules(json.data);
          setMaintenanceScheduleId((current) => {
            if (current && !json.data.some((s: MaintenanceScheduleOption) => s.id === current)) {
              return '';
            }
            return current;
          });
        } else {
          setSchedules([]);
          setMaintenanceScheduleId('');
        }
      })
      .catch(() => {
        setSchedules([]);
      });
  }, [equipmentId, canViewMro]);

  const handleAddItem = () => {
    if (!selectedNomenclature) return;
    const qty = parseFloat(itemQty);
    const price = parseFloat(itemPrice);
    if (isNaN(qty) || qty <= 0) {
      enqueueSnackbar('Укажите корректное количество (> 0)', { variant: 'warning' });
      return;
    }
    if (isNaN(price) || price < 0) {
      enqueueSnackbar('Укажите корректную цену (>= 0)', { variant: 'warning' });
      return;
    }

    setLineItems((prev) =>
      addOrMergeLineItem(prev, {
        nomenclatureId: selectedNomenclature.id,
        nomenclatureName: selectedNomenclature.name,
        nomenclatureArticle: selectedNomenclature.article || undefined,
        unit: selectedNomenclature.unit,
        requestedQty: qty,
        estimatedPrice: price,
      }),
    );

    setSelectedNomenclature(null);
    setItemQty('1');
    setItemPrice('0');
  };

  const handleRemoveItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddShortageItems = async () => {
    if (!targetWarehouseId) {
      enqueueSnackbar('Сначала выберите склад назначения', { variant: 'warning' });
      return;
    }

    setLoadingShortage(true);
    try {
      const response = await fetch(`/api/prm/shortages?warehouseId=${encodeURIComponent(targetWarehouseId)}`);
      const body = await response.json();
      if (!response.ok || !body.success) {
        enqueueSnackbar(body.error || 'Не удалось получить дефицитные позиции', { variant: 'error' });
        return;
      }

      const suggestions: Array<{ nomenclatureId: string; shortageQty: number }> = Array.isArray(body.data) ? body.data : [];
      setLineItems((current) => suggestions.reduce((items: PrmRequestLineItem[], suggestion) => {
        const nomenclature = nomenclatures.find((item) => item.id === suggestion.nomenclatureId);
        if (!nomenclature) return items;
        return addOrMergeLineItem(items, {
          nomenclatureId: nomenclature.id,
          nomenclatureName: nomenclature.name,
          nomenclatureArticle: nomenclature.article || undefined,
          unit: nomenclature.unit,
          requestedQty: Number(suggestion.shortageQty),
          estimatedPrice: 0,
        });
      }, current));
      enqueueSnackbar(
        suggestions.length > 0 ? `Добавлено дефицитных позиций: ${suggestions.length}` : 'Дефицитных позиций не найдено',
        { variant: suggestions.length > 0 ? 'success' : 'info' },
      );
    } catch {
      enqueueSnackbar('Ошибка сети при загрузке дефицита', { variant: 'error' });
    } finally {
      setLoadingShortage(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validatePurchaseRequest({
      targetWarehouseId,
      priority,
      justification,
      supplierName,
      equipmentId,
      maintenanceScheduleId,
      lineItems,
    });
    if (validationError) {
      enqueueSnackbar(validationError, { variant: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/prm/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildPurchaseRequestPayload({
            targetWarehouseId,
            priority,
            justification,
            supplierName,
            equipmentId,
            maintenanceScheduleId,
            lineItems,
          }),
        ),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        enqueueSnackbar('Заявка на закупку ТМЦ создана в статусе черновика', { variant: 'success' });
        onSuccess();
        onClose();
      } else {
        enqueueSnackbar(json.error || 'Ошибка создания заявки', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Ошибка сети при отправке заявки', { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedTotal = calculateEstimatedTotal(lineItems);

  return (
    <FormDialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title="Новая заявка на закупку ТМЦ"
      subtitle="Оформление потребности с позициями номенклатуры и оценочной стоимостью"
      icon={<ShoppingCartOutlinedIcon color="primary" />}
      maxWidth="md"
      loading={isSubmitting}
      submitLabel="Создать заявку"
      submitIcon={<SendIcon />}
      onSubmit={handleSubmit}
      submitDisabled={isSubmitting || !targetWarehouseId || lineItems.length === 0}
    >
      <Stack spacing={2.5}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              required
              label="Склад назначения"
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>— Выберите склад —</em>
              </MenuItem>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Приоритет"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {Object.entries(PURCHASE_REQUEST_PRIORITY_MAP).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="Оборудование (EPS, необязательно)"
              value={equipmentId}
              disabled={!canViewEps}
              onChange={(e) => {
                const nextEqId = e.target.value;
                setEquipmentId(nextEqId);
                if (!nextEqId) setMaintenanceScheduleId('');
              }}
              SelectProps={{ displayEmpty: true }}
              helperText={
                !canViewEps
                  ? 'Требуется право на просмотр оборудования (EPS)'
                  : equipmentList.length >= 500
                  ? 'Отображены первые 500 единиц оборудования'
                  : undefined
              }
            >
              <MenuItem value="">
                <em>— Без привязки к оборудованию —</em>
              </MenuItem>
              {equipmentId && !equipmentList.some((eq) => eq.id === equipmentId) && (
                <MenuItem key={equipmentId} value={equipmentId}>
                  Загрузка выбранного оборудования... ({equipmentId})
                </MenuItem>
              )}
              {equipmentList.map((eq) => (
                <MenuItem key={eq.id} value={eq.id}>
                  {eq.name} {eq.inventoryNumber ? `(${eq.inventoryNumber})` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              size="small"
              label="График ТО (MRO, необязательно)"
              value={maintenanceScheduleId}
              disabled={!canViewMro || !equipmentId || schedules.length === 0}
              onChange={(e) => setMaintenanceScheduleId(e.target.value)}
              SelectProps={{ displayEmpty: true }}
              helperText={
                !canViewMro
                  ? 'Требуется право на просмотр графиков ТО (MRO)'
                  : !equipmentId
                  ? 'Сначала выберите оборудование'
                  : schedules.length === 0
                  ? 'Для выбранного оборудования нет графиков ТО'
                  : schedules.length >= 500
                  ? 'Отображены первые 500 графиков ТО'
                  : undefined
              }
            >
              <MenuItem value="">
                <em>— Без привязки к графику ТО —</em>
              </MenuItem>
              {maintenanceScheduleId && !schedules.some((sch) => sch.id === maintenanceScheduleId) && (
                <MenuItem key={maintenanceScheduleId} value={maintenanceScheduleId}>
                  Загрузка выбранного графика ТО... ({maintenanceScheduleId})
                </MenuItem>
              )}
              {schedules.map((sch) => (
                <MenuItem key={sch.id} value={sch.id}>
                  {sch.title}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Предполагаемый поставщик (необязательно)"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Обоснование потребности (необязательно)"
              placeholder="Например: пополнение неснижаемого остатка, замена изношенных узлов..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ p: 2, borderRadius: '8px', bgcolor: 'background.default', border: '1px solid divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Позиции ТМЦ:
            </Typography>
            <Button size="small" variant="outlined" onClick={handleAddShortageItems} disabled={loadingShortage || !targetWarehouseId}>
              {loadingShortage ? 'Загрузка дефицита...' : 'Добавить дефицитные позиции'}
            </Button>
          </Box>

          <Grid container spacing={1.5} alignItems="flex-start">
            <Grid item xs={12} sm={5}>
              <Autocomplete
                size="small"
                options={nomenclatures}
                getOptionLabel={(o) => `${o.name} (${o.article || o.unit})`}
                value={selectedNomenclature}
                onChange={(_, val) => setSelectedNomenclature(val)}
                renderInput={(params) => (
                  <TextField {...params} label="Поиск номенклатуры..." placeholder="Название или артикул..." />
                )}
              />
            </Grid>

            <Grid item xs={4} sm={2}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label={`Кол-во (${selectedNomenclature?.unit || 'ед'})`}
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                inputProps={{ min: 0.01, step: 'any' }}
              />
            </Grid>

            <Grid item xs={4} sm={2}>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Цена за ед., ₽"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
              />
            </Grid>

            <Grid item xs={4} sm={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
                disabled={!selectedNomenclature || parseFloat(itemQty) <= 0 || isNaN(parseFloat(itemQty))}
                sx={{ height: 40, borderRadius: '8px', fontWeight: 600 }}
              >
                Добавить
              </Button>
            </Grid>
          </Grid>

          {lineItems.length > 0 && (
            <Paper variant="outlined" sx={{ mt: 2, borderRadius: '8px', overflow: 'hidden' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'background.paper' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>№</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Номенклатура</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>
                      Кол-во
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>
                      Цена
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 140 }}>
                      Сумма
                    </TableCell>
                    <TableCell align="center" sx={{ width: 50 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, idx) => (
                    <TableRow key={item.nomenclatureId} hover>
                      <TableCell sx={{ py: 1, color: 'text.secondary' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ py: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {item.nomenclatureName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {item.nomenclatureArticle ? `Арт: ${item.nomenclatureArticle} • ` : ''}
                          {item.unit}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1, fontWeight: 700 }}>
                        {item.requestedQty} {item.unit}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1 }}>
                        {item.estimatedPrice.toLocaleString('ru-RU')} ₽
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1, fontWeight: 700, color: 'primary.main' }}>
                        {(item.requestedQty * item.estimatedPrice).toLocaleString('ru-RU')} ₽
                      </TableCell>
                      <TableCell align="center" sx={{ py: 0.5 }}>
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Итого: {estimatedTotal.toLocaleString('ru-RU')} ₽
                </Typography>
              </Box>
            </Paper>
          )}
        </Paper>
      </Stack>
    </FormDialog>
  );
}
