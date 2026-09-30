import csv
import io
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from core import APIError, csv_text, money
from app import SmartFind


class BusinessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.inventory = SmartFind(Path(self.temp.name)/"test.db")

    def tearDown(self):
        self.temp.cleanup()

    def call(self, app, method, path, data=None, query=None):
        return app.handle(method, path, data or {}, query or {})

    def test_money_exactness_and_invalid_values(self):
        self.assertEqual(money('0.29'), 29)
        self.assertEqual(money('1.10'), 110)
        for invalid in ['NaN', 'Infinity', '-1', '1.001', None, '1000001']:
            with self.subTest(invalid=invalid), self.assertRaises(APIError):
                money(invalid)

    def test_stock_change_has_audit_record(self):
        result = self.call(self.inventory, 'POST', '/adjust', {'product_id':1,'delta':-3,'reason':'Demo sale'})
        self.assertEqual(result['stock'], 45)
        ledger = self.call(self.inventory, 'GET', '/movements')
        self.assertEqual((ledger[0]['delta'],ledger[0]['reason']), (-3,'Demo sale'))

    def test_failed_stock_change_rolls_back_everything(self):
        before = self.call(self.inventory, 'GET', '/movements')
        with self.assertRaises(APIError):
            self.call(self.inventory, 'POST', '/adjust', {'product_id':1,'delta':-49,'reason':'Too much'})
        self.assertEqual(self.call(self.inventory,'GET','/movements'), before)
        with self.inventory.db.connect() as conn:
            self.assertEqual(conn.execute('SELECT stock FROM products WHERE id=1').fetchone()[0],48)

    def test_concurrent_changes_do_not_oversell(self):
        def consume(_):
            try:
                self.call(self.inventory,'POST','/adjust',{'product_id':1,'delta':-30,'reason':'Concurrent sale'})
                return True
            except APIError:
                return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(consume,range(2)))
        self.assertEqual(sum(outcomes), 1)
        with self.inventory.db.connect() as conn:
            self.assertEqual(conn.execute('SELECT stock FROM products WHERE id=1').fetchone()[0],18)

    def test_seed_is_not_reinserted_on_restart(self):
        self.call(self.inventory,'POST','/adjust',{'product_id':1,'delta':-1,'reason':'Persisted'})
        restarted = SmartFind(self.inventory.db.path)
        self.assertEqual(len(self.call(restarted,'GET','/products')),4)
        with restarted.db.connect() as conn:
            self.assertEqual(conn.execute('SELECT stock FROM products WHERE id=1').fetchone()[0],47)

    def test_duplicate_sku_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.call(self.inventory,'POST','/products',{'name':'Duplicate','sku':'PEN-01','category':'Test','price':'1','stock':0,'reorder_level':1})

    def test_sql_injection_is_stored_as_plain_text(self):
        name = "Test'); DROP TABLE products; --"
        self.call(self.inventory,'POST','/products',{'name':name,'sku':'SAFE-1','category':'Test','price':'1','stock':0,'reorder_level':0})
        self.assertEqual(len(self.call(self.inventory,'GET','/products')),5)
