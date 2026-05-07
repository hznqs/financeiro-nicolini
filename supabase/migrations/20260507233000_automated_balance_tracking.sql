-- Automated balance tracking for credit cards
-- This migration adds triggers to keep cards.spent_amount in sync with purchases and expenses.

-- 1. Function to handle updates on cards.spent_amount from Purchases
CREATE OR REPLACE FUNCTION public.sync_card_balance_from_purchase()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.card_id IS NOT NULL THEN
            UPDATE public.cards 
            SET spent_amount = COALESCE(spent_amount, 0) + NEW.amount 
            WHERE id = NEW.card_id;
        END IF;
        
    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.card_id IS NOT NULL THEN
            UPDATE public.cards 
            SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount 
            WHERE id = OLD.card_id;
        END IF;
        
    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Case 1: Changed card_id
        IF (OLD.card_id IS DISTINCT FROM NEW.card_id) THEN
            -- Decrease old card
            IF OLD.card_id IS NOT NULL THEN
                UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount WHERE id = OLD.card_id;
            END IF;
            -- Increase new card
            IF NEW.card_id IS NOT NULL THEN
                UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) + NEW.amount WHERE id = NEW.card_id;
            END IF;
        -- Case 2: Same card, different amount
        ELSIF (OLD.card_id IS NOT NULL AND OLD.amount IS DISTINCT FROM NEW.amount) THEN
            UPDATE public.cards 
            SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount + NEW.amount 
            WHERE id = NEW.card_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- 2. Function to handle updates from Installments (when paid, reduces spent_amount)
CREATE OR REPLACE FUNCTION public.sync_card_balance_from_installment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_card_id UUID;
BEGIN
    -- We only care about card-based purchases
    SELECT card_id INTO v_card_id FROM public.purchases WHERE id = NEW.purchase_id;
    
    IF v_card_id IS NOT NULL THEN
        -- When installment status changes to 'paid'
        IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
            UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) - NEW.amount WHERE id = v_card_id;
        -- When installment status changes from 'paid' back to something else
        ELSIF (OLD.status = 'paid' AND NEW.status != 'paid') THEN
            UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) + NEW.amount WHERE id = v_card_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- 3. Function to handle updates from Expenses
CREATE OR REPLACE FUNCTION public.sync_card_balance_from_expense()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.card_id IS NOT NULL THEN
            UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) + NEW.amount WHERE id = NEW.card_id;
        END IF;
        
    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.card_id IS NOT NULL THEN
            UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount WHERE id = OLD.card_id;
        END IF;
        
    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.card_id IS DISTINCT FROM NEW.card_id) THEN
            IF OLD.card_id IS NOT NULL THEN
                UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount WHERE id = OLD.card_id;
            END IF;
            IF NEW.card_id IS NOT NULL THEN
                UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) + NEW.amount WHERE id = NEW.card_id;
            END IF;
        ELSIF (OLD.card_id IS NOT NULL AND OLD.amount IS DISTINCT FROM NEW.amount) THEN
            UPDATE public.cards SET spent_amount = COALESCE(spent_amount, 0) - OLD.amount + NEW.amount WHERE id = NEW.card_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- Triggers
DROP TRIGGER IF EXISTS tr_sync_card_purchase ON public.purchases;
CREATE TRIGGER tr_sync_card_purchase AFTER INSERT OR UPDATE OR DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.sync_card_balance_from_purchase();

DROP TRIGGER IF EXISTS tr_sync_card_installment ON public.installments;
CREATE TRIGGER tr_sync_card_installment AFTER UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.sync_card_balance_from_installment();

DROP TRIGGER IF EXISTS tr_sync_card_expense ON public.expenses;
CREATE TRIGGER tr_sync_card_expense AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.sync_card_balance_from_expense();
