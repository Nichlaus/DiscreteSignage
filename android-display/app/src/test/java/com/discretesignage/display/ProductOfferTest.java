package com.discretesignage.display;
import org.junit.Test;
import java.util.HashMap;
import java.util.Map;
import static org.junit.Assert.*;
public class ProductOfferTest {
    private Map<String,Object> response() {
        Map<String,Object> product = new HashMap<>();
        product.put("name","Tote"); product.put("description","Cotton"); product.put("available",true); product.put("priceCents",1250);
        Map<String,Object> result = new HashMap<>(); result.put("product",product); result.put("currency","AUD");
        result.put("version",1); result.put("serverNow",100000); result.put("expiresAt",160000); return result;
    }
    @Test public void leaseSubtractsNetworkTimeAndDoesNotUseDeviceWallClock() {
        ProductOffer offer = ProductOffer.read(response(),1000,3000);
        assertNotNull(offer); assertEquals(61000,offer.deadline); assertEquals(1250,offer.cents);
        assertNull(ProductOffer.read(response(),1000,61000));
        assertNull(ProductOffer.read(response(),3000,1000));
    }
    @Test public void unavailableMalformedOrOverlongLeasesFailClosed() {
        Map<String,Object> data = response(); data.put("expiresAt",160001); assertNull(ProductOffer.read(data,0,0));
        data = response(); data.put("currency","USD"); assertNull(ProductOffer.read(data,0,0));
        data = response(); data.put("product",null); assertNull(ProductOffer.read(data,0,0));
        data = response(); ((Map<String,Object>)data.get("product")).put("available",false); assertNull(ProductOffer.read(data,0,0));
        data = response(); ((Map<String,Object>)data.get("product")).put("priceCents",1.5); assertNull(ProductOffer.read(data,0,0));
    }
}
